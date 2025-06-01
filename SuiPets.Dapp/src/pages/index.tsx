import React, { useState, useEffect, useMemo } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
  useSuiClientQueries,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID = "0xafa475ec90d2eacab95035ebb39624c709b9810000357a78969a6065addf92b1";
const CONFIG_ID = "0x8cd2f48ec5f59cccbfae2a72be0c53b3555324ff9a8ce6f72865904d4bd3fa88";
const TOKEN_TREASURY_ID = "0xf8556af96b48c03ca79e83a1e281a3c4363912836ad55831c6a57a7dd7fd4360";
const TREASURY_ID = "0x4f71a27989b56eb2fece1f5a9cdf3a2fd641b13510a8f5fc2cf94f7882939916";
const CLOCK_ID = "0x6";
const RANDOM_ID = "0x1";

interface Pet {
  id: string;
  pet_config_id: number;
  pet_level: number;
  pet_name: string;
  pet_type: string;
  earned_balance: string;
  total_earned_amount: string;
  hungry_timestamp_ms: number;
  claimed_at_timestamp_ms: number;
}

interface Food {
  id: string;
  food_config_id: number;
  food_name: string;
  food_type: string;
  food_level: number;
  food_price: number;
}

function calculateEarnedAmount(pet: any, earnPerSec: number) {
  const currentTime = Date.now();
  const endTime = Math.min(currentTime, Number(pet.hungry_timestamp_ms));
  const timeSinceClaim = endTime > Number(pet.claimed_at_timestamp_ms) ? endTime - Number(pet.claimed_at_timestamp_ms) : 0;
  const timeDiffSec = Math.floor(timeSinceClaim / 1000);
  const earnRate = Number(earnPerSec) + (Number(earnPerSec) * Number(pet.base_earn_level_percent) / 100);
  const earned = timeDiffSec * earnRate + Number(pet.earned_balance);

  const amount = Number(earned.toFixed(7));

  return amount < 0 ? 0 : amount;
}

const getTimeLeft = (hungryTimestamp: number) => {
  const now = Date.now();
  const timeLeftMs = hungryTimestamp - now;
  if (timeLeftMs <= 0) return "Pet is hungry!";
  const seconds = Math.floor((timeLeftMs / 1000) % 60);
  const minutes = Math.floor((timeLeftMs / (1000 * 60)) % 60);
  const hours = Math.floor((timeLeftMs / (1000 * 60 * 60)) % 24);
  return `${hours}h ${minutes}m ${seconds}s`;
};

const HomePage: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [activeTab, setActiveTab] = useState<"Pets" | "Market" | "Battle">("Pets");
  const [activeMarketSection, setActiveMarketSection] = useState<"Foods" | "Mint">("Foods");
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [earnedTokens, setEarnedTokens] = useState<{ [petId: string]: number }>({});
  const [isFeedModalOpen, setIsFeedModalOpen] = useState<boolean>(false);

  // Owner Pets
  const { data: ownerPets, refetch: refetchPets } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: currentAccount?.address || "",
      filter: { StructType: `${PACKAGE_ID}::mechanics::Pet` },
      options: { showContent: true },
    },
    { enabled: !!currentAccount?.address }
  );

  // Owner Foods
  const { data: ownedFoods, refetch: refetchFoods } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: currentAccount?.address || "",
      filter: { StructType: `${PACKAGE_ID}::mechanics::Food` },
      options: { showContent: true },
    },
    { enabled: !!currentAccount?.address }
  );

  // Select Pet
  const { data: selectedPetData, refetch: refetchSelectedPetData } = useSuiClientQuery(
    "getObject",
    {
      id: selectedPet as string,
      options: { showContent: true },
    },
    {
      enabled: !!selectedPet
    }
  );

  // owned Food Parsed
  const ownedFoodsParsed = useMemo(() => {
    if (!ownedFoods?.data) return [];

    return ownedFoods.data
      .map((obj: any, index: number) => {
        const content = obj.data?.content?.fields;
        if (!content) {
          console.warn(`No content for food ${index}:`, obj);
          return null;
        }
        return {
          id: obj.data?.objectId || `food-owned-${index}`,
          food_config_id: Number(content.food_config_id || 0),
          food_name: content.food_name ? Buffer.from(content.food_name).toString("utf8") : "Unknown",
          food_type: content.food_type ? Buffer.from(content.food_type).toString("utf8") : "Unknown",
          food_level: Number(content.food_level || 0),
        };
      })
      .filter((food): food is Food => food !== null);
  }, [ownedFoods]);

  // Config
  const { data: config, isLoading: configLoading, error: configError } = useSuiClientQuery(
    "getObject",
    {
      id: CONFIG_ID,
      options: { showContent: true, showType: true },
    }
  );

  // Config Food Dynamic Fields
  const { data: cofigFoodDynamicFields, isLoading: fieldsLoading, error: fieldsError } = useSuiClientQuery(
    "getDynamicFields",
    {
      parentId: (config?.data?.content as any)?.fields?.foods?.fields?.id?.id,
    },
    {
      enabled: !!config && activeTab === "Market" && activeMarketSection === "Foods",
    }
  );

  // Config Food Dynamic Object Field
  const { data: configFoodDynamicObjectFields, isPending: fieldsPending, isError: fieldsDynamicError } = useSuiClientQueries({
    queries: cofigFoodDynamicFields?.data?.map((field) => ({
      method: "getDynamicFieldObject",
      params: {
        parentId: (config?.data?.content as any)?.fields?.foods?.fields?.id?.id,
        name: { type: "u64", value: field.name.value },
      },
    })) || [],
    combine: (result) => ({
      data: result.map((res) => res.data),
      isSuccess: result.every((res) => res.isSuccess),
      isPending: result.some((res) => res.isPending),
      isError: result.some((res) => res.isError),
    }),
  });

  // Confg Foods
  const configFoods = useMemo(() => {
    if (!configFoodDynamicObjectFields) return [];

    return configFoodDynamicObjectFields.map((field: any, index: number) => {
      const content = field?.data?.content?.fields?.value?.fields;
      if (!content) {
        console.warn(`No content for food field ${index}:`, field);
        return null;
      }
      return {
        id: field.data?.objectId || `food-${index}`,
        food_config_id: Number(field?.data?.content?.fields?.name || 0),
        food_name: content.food_name ? Buffer.from(content.food_name).toString("utf8") : "",
        food_type: content.food_type ? Buffer.from(content.food_type).toString("utf8") : "",
        food_level: Number(content.food_level || 0),
        food_price: Number(content.food_price || 0) / 1e9,
      };
    })
      .filter((food): food is Food => food !== null);
  }, [configFoodDynamicObjectFields]);

  // Interval Earning Amount
  useEffect(() => {
    if (!ownerPets?.data || !(config?.data?.content as any)?.fields?.earn_per_sec) return;

    const earnPerSec = Number((config?.data?.content as any).fields.earn_per_sec) / 1e9;

    const updateEarnedTokens = () => {
      const newEarnedTokens: { [petId: string]: number } = {};

      ownerPets.data.forEach((obj) => {
        const pet = (obj.data?.content as any).fields;

        const earned = calculateEarnedAmount(pet, earnPerSec);

        newEarnedTokens[obj.data?.objectId!] = earned;
      });

      setEarnedTokens(newEarnedTokens);
    };

    updateEarnedTokens();

    const interval = setInterval(updateEarnedTokens, 1000);

    return () => clearInterval(interval);
  }, [ownerPets, config]);

  // Feed Pet Function
  const handleFeedPet = async (petId: string, foodId: string) => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }

    try {
      const tx = new Transaction();
      console.log("Feeding Pet:", { petId, foodId, CONFIG_ID, CLOCK_ID });

      tx.moveCall({
        target: `${PACKAGE_ID}::mechanics::feed_pet`,
        arguments: [
          tx.object(petId),
          tx.object(foodId),
          tx.object(CONFIG_ID),
          tx.object(CLOCK_ID),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: () => {
            alert("Pet fed successfully!");
            refetchPets();
            refetchFoods();
            refetchSelectedPetData();
            setIsFeedModalOpen(false);
          },
          onError: (error) => {
            console.error("Feed Error:", error);
            alert(`Feed Error: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Feed Setup Error:", error);
      alert(`Feed Setup Error: ${error}`);
    }
  };

  // Claim Function
  const handleClaim = async (petId: string) => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::mechanics::claim_pet`,
      arguments: [tx.object(petId), tx.object(CONFIG_ID), tx.object(TOKEN_TREASURY_ID), tx.object(CLOCK_ID)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert("Claimed successfully!");
          refetchPets();
          setEarnedTokens({});
        },
        onError: (error) => alert(`Claim Error: ${error.message}`),
      }
    );
  };

  // Mint Function
  const handleMintPet = async () => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::mechanics::create_pet`,
      arguments: [
        tx.object(CONFIG_ID),
        tx.object(TREASURY_ID),
        tx.object(RANDOM_ID),
        tx.object(CLOCK_ID),
        tx.splitCoins(tx.gas, [tx.pure("u256", 5000000000)]),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert("Pet minted successfully!");
          refetchPets();
        },
        onError: (error) => alert(`Mint Error: ${error.message}`),
      }
    );
  };

  console.log(ownedFoods)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900/50 to-teal-900/50 backdrop-blur-xl text-white font-sans">
      {/* Navbar */}
      <nav className="bg-blue-800/30 backdrop-blur-lg p-4 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex space-x-4">
            {["Pets", "Market", "Battle"].map((tab) => (
              <button
                key={tab}
                className={`px-5 py-2 rounded-full transition-all duration-300 ${activeTab === tab
                  ? "bg-blue-600/70 text-white shadow-lg"
                  : "bg-transparent hover:bg-blue-500/50 text-gray-200"
                  } ${tab === "Battle" ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => tab !== "Battle" && setActiveTab(tab as "Pets" | "Market" | "Battle")}
                disabled={tab === "Battle"}
              >
                {tab}
                {tab === "Battle" && " (Coming soon)"}
              </button>
            ))}
          </div>
          <ConnectButton className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full transition-all duration-300" />
        </div>
      </nav>

      {isFeedModalOpen && selectedPet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-blue-900/80 backdrop-blur-lg p-6 rounded-xl border border-teal-500/30 shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold text-teal-300 mb-4">Select Food to Feed</h3>
            {ownedFoodsParsed.length ? (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {ownedFoodsParsed.map((food) => (
                  <div
                    key={food.id}
                    className="p-4 bg-blue-800/20 rounded-lg border border-teal-600/30 cursor-pointer hover:bg-blue-700/30 transition-all duration-200"
                    onClick={() => handleFeedPet(selectedPet, food.id)}
                  >
                    <p className="text-gray-200">
                      <span className="font-semibold text-teal-200">Name:</span> {food.food_name}
                    </p>
                    <p className="text-gray-200">
                      <span className="font-semibold text-teal-200">Type:</span> {food.food_type}
                    </p>
                    <p className="text-gray-200">
                      <span className="font-semibold text-teal-200">Level:</span> {food.food_level}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No foods available in your inventory.</p>
            )}
            <button
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-all duration-300"
              onClick={() => setIsFeedModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6">
        {activeTab === "Pets" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-teal-300 drop-shadow">Your Pets</h2>
              {!currentAccount ? (
                <p className="text-center text-lg text-gray-300">Please connect wallet to view Pets.</p>
              ) : ownerPets?.data.length === 0 ? (
                <p className="text-gray-400">No pets found. Try minting one!</p>
              ) : (
                <div className="space-y-4">
                  {ownerPets?.data.map((obj) => {
                    const pet = (obj.data?.content as any).fields;
                    return (
                      <div
                        key={obj.data?.objectId}
                        className={`p-5 bg-blue-800/20 backdrop-blur-md rounded-xl cursor-pointer transition-all duration-300 border border-blue-500/30 ${selectedPet === obj.data?.objectId ? "shadow-xl border-teal-400/50" : "hover:shadow-lg"
                          }`}
                        onClick={() => setSelectedPet(obj.data?.objectId!)}
                      >
                        <p className="text-lg font-semibold text-teal-200">Name: {pet.pet_name ? Buffer.from(pet.pet_name).toString("utf8") : "Unknown"}</p>
                        <p className="text-gray-300">Level: {pet.pet_level}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedPet && selectedPetData && (
              <div className="p-6 bg-blue-900/20 backdrop-blur-lg rounded-xl border border-teal-500/30 shadow-xl">
                <h2 className="text-2xl font-bold text-teal-300 mb-4 drop-shadow">Pet Details</h2>
                <div className="space-y-3 text-gray-200">
                  <p>
                    <span className="font-semibold text-teal-200">Name:</span>{" "}
                    {(selectedPetData.data?.content as any).fields.pet_name
                      ? Buffer.from((selectedPetData.data?.content as any).fields.pet_name).toString("utf8")
                      : "Unknown"}
                  </p>
                  <p>
                    <span className="font-semibold text-teal-200">Type:</span>{" "}
                    {(selectedPetData.data?.content as any).fields.pet_type
                      ? Buffer.from((selectedPetData.data?.content as any).fields.pet_type).toString("utf8")
                      : "Unknown"}
                  </p>
                  <p>
                    <span className="font-semibold text-teal-200">Level:</span>{" "}
                    {(selectedPetData.data?.content as any).fields.pet_level}
                  </p>
                  <p>
                    <span className="font-semibold text-teal-200">Total Earned:</span>{" "}
                    {(selectedPetData.data?.content as any).fields.total_earned_amount}
                  </p>
                  <p>
                    <span className="font-semibold text-teal-200">Time until hungry:</span>{" "}
                    {getTimeLeft((selectedPetData.data?.content as any).fields.hungry_timestamp_ms)}
                  </p>
                  <p>
                    <span className="font-semibold text-teal-200">Tokens earning:</span>{" "}
                    <span className="text-teal-400 font-bold">{earnedTokens[selectedPet]?.toFixed(7) || 0} SPT</span>
                  </p>
                </div>
                <div className="mt-6 flex space-x-4">
                  <button
                    className="bg-teal-600 text-white px-6 py-2 rounded-full hover:bg-teal-700 transition-all duration-300 shadow-md"
                    onClick={() => handleClaim(selectedPet)}
                  >
                    Claim
                  </button>
                  <button
                    className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition-all duration-300 shadow-md"
                    onClick={() => setIsFeedModalOpen(true)}
                  >
                    Feed Pet
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "Market" && (
          <div>
            <div className="flex space-x-4 mb-6">
              {["Foods", "Mint"].map((section) => (
                <button
                  key={section}
                  className={`px-5 py-2 rounded-full transition-all duration-300 ${activeMarketSection === section
                    ? "bg-teal-600 text-white shadow-md"
                    : "bg-blue-800/20 hover:bg-blue-500/30 text-gray-200 border border-teal-500/30"
                    }`}
                  onClick={() => setActiveMarketSection(section as "Foods" | "Mint")}
                >
                  {section}
                </button>
              ))}
            </div>

            {activeMarketSection === "Foods" && (
              <div>
                <h2 className="text-3xl font-bold mb-6 text-teal-600 drop-shadow">Available Foods</h2>
                {configLoading || fieldsLoading || fieldsPending ? (
                  <p className="text-gray-400">Loading foods...</p>
                ) : configError || fieldsError || fieldsDynamicError ? (
                  <p className="text-red-400">
                    Error loading foods: {configError?.message || fieldsError?.message || "Dynamic fields error"}
                  </p>
                ) : configFoods.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configFoods.map((food: Food) => (
                      <div
                        key={food.id}
                        className="p-5 bg-blue-800/20 backdrop-blur-md rounded-xl border border-teal-500/30 shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <p className="text-gray-200">
                          <span className="font-semibold text-teal-200">Name:</span> {food.food_name}
                        </p>
                        <p className="text-gray-200">
                          <span className="font-semibold text-teal-200">Type:</span> {food.food_type}
                        </p>
                        <p className="text-gray-200">
                          <span className="font-semibold text-teal-200">Level:</span> {food.food_level}
                        </p>
                        <p className="text-gray-200">
                          <span className="font-semibold text-teal-200">Price:</span> {food.food_price} SUI
                        </p>
                        <button
                          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-all duration-300 shadow-sm"
                          onClick={() => alert(`Buy food ${food.food_name} (not implemented)`)}
                        >
                          Buy
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No foods available.</p>
                )}
              </div>
            )}

            {activeMarketSection === "Mint" && (
              <div className="p-6 bg-blue-900/20 backdrop-blur-lg rounded-xl">
                <h2 className="text-3xl font-bold mb-6 text-teal-300 drop-shadow">Mint New Pet</h2>
                <button
                  className="bg-teal-600 text-white px-6 py-2 rounded-full hover:bg-teal-700 transition-all duration-300 shadow-md"
                  onClick={handleMintPet}
                >
                  Mint Pet (5 SUI)
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "Battle" && (
          <div className="text-center p-6 bg-blue-900/20 backdrop-blur-lg">
            <h3 className="text-3xl font-bold text-teal-300 drop-shadow">Battle (Coming Soon)</h3>
            <p className="text-lg text-gray-400 mt-4">Stay tuned for epic battles!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;