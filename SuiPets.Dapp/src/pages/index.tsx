import React, { useState, useEffect, useMemo } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
  useSuiClientQueries,
  useSuiClient,
} from "@mysten/dapp-kit";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";

interface Food {
  id: string;
  food_config_id: number;
  food_name: string;
  food_type: string;
  food_level: number;
  food_price: number;
}

// Constants and other imports remain the same
const PACKAGE_ID = "0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a";
const CONFIG_ID = "0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e";
const TOKEN_TREASURY_ID = "0xf1a030f2e1f688dcd0ac22f82afd52c491f937dfb83e7d0ff8ec534b0f1b4566";
const TREASURY_ID = "0xe50db93b0fc08787bbc64bbf7403f4754e843c64a52b95c7bf99dd3750e6b686";
const CLOCK_ID = "0x6";
const RANDOM_ID = "0x8";

// Utility functions (calculateEarnedAmount, getTimeLeft) remain unchanged
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

// Map pet_type to image paths
const petImages: { [key: string]: string } = {
  dog: "./assets/pets/dog.png",
  dragon: "/assets/pets/dragon.png",
};

// Map food_type to image paths
const foodImages: { [key: string]: string } = {
  meat: "/assets/foods/meat.png",
  fish: "/assets/foods/fish.png",
};

const HomePage: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const [activeTab, setActiveTab] = useState<"Pets" | "Market" | "Battle">("Pets");
  const [activeMarketSection, setActiveMarketSection] = useState<"Foods" | "Mint">("Foods");
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [earnedTokens, setEarnedTokens] = useState<{ [petId: string]: number }>({});
  const [isFeedModalOpen, setIsFeedModalOpen] = useState<boolean>(false);
  const [isBuying, setIsBuying] = useState(false);

  // Queries and logic remain unchanged
  const { data: ownerPets, refetch: refetchPets } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: currentAccount?.address || "",
      filter: { StructType: `${PACKAGE_ID}::mechanics::Pet` },
      options: { showContent: true },
    },
    { enabled: !!currentAccount?.address }
  );

  const { data: ownedFoods, refetch: refetchFoods } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: currentAccount?.address || "",
      filter: { StructType: `${PACKAGE_ID}::mechanics::Food` },
      options: { showContent: true },
    },
    { enabled: !!currentAccount?.address }
  );

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

  const { data: config, isLoading: configLoading, error: configError } = useSuiClientQuery(
    "getObject",
    {
      id: CONFIG_ID,
      options: { showContent: true, showType: true },
    }
  );

  const { data: cofigFoodDynamicFields, isLoading: fieldsLoading, error: fieldsError } = useSuiClientQuery(
    "getDynamicFields",
    {
      parentId: (config?.data?.content as any)?.fields?.foods?.fields?.id?.id,
    },
    {
      enabled: !!config && activeTab === "Market" && activeMarketSection === "Foods",
    }
  );

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

  const handleFeedPet = async (petId: string, foodId: string) => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }
    try {
      const estimatedGasFee = BigInt(100_000_000);
      let coins = await client.getCoins({
        owner: currentAccount.address,
        coinType: "0x2::sui::SUI",
      });

      if (coins.data.length < 1) {
        alert("No SUI coins available for gas!");
        return;
      }
      if (coins.data.length === 1) {
        const largestCoin = coins.data[0];
        if (BigInt(largestCoin.balance) < estimatedGasFee * BigInt(2)) {
          alert("Insufficient SUI balance to split for gas!");
          return;
        }

        const txSplit = new Transaction();
        const [coin1, coin2] = txSplit.splitCoins(
          txSplit.object(largestCoin.coinObjectId),
          [txSplit.pure.u64(estimatedGasFee), txSplit.pure.u64(BigInt(largestCoin.balance) - estimatedGasFee)]
        );
        txSplit.transferObjects([coin1, coin2], currentAccount.address);

        signAndExecute(
          { transaction: txSplit },
          {
            onSuccess: () => console.log("Coin split successfully!"),
            onError: (error) => alert(`Split Error: ${error.message}`),
          }
        );

        coins = await client.getCoins({
          owner: currentAccount.address,
          coinType: "0x2::sui::SUI",
        });
      }

      const gasCoin = coins.data[0];
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::mechanics::feed_pet`,
        arguments: [
          tx.object(petId),
          tx.object(foodId),
          tx.object(CONFIG_ID),
          tx.object(CLOCK_ID),
        ],
      });
      tx.setGasPayment([{ objectId: gasCoin.coinObjectId, version: gasCoin.version, digest: gasCoin.digest }]);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            alert("Pet fed successfully!");
            refetchPets();
            refetchFoods();
            refetchSelectedPetData();
            setIsFeedModalOpen(false);
          },
          onError: (error) => alert(`Feed Error: ${error.message}`),
        }
      );
    } catch (error: any) {
      alert(`Feed Setup Error: ${error.message}`);
    }
  };

  const handleClaim = async (petId: string) => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }
    try {
      const estimatedGasFee = BigInt(100_000_000);
      let coins = await client.getCoins({
        owner: currentAccount.address,
        coinType: "0x2::sui::SUI",
      });

      if (coins.data.length < 1) {
        alert("No SUI coins available for gas!");
        return;
      }
      if (coins.data.length === 1) {
        const largestCoin = coins.data[0];
        if (BigInt(largestCoin.balance) < estimatedGasFee * BigInt(2)) {
          alert("Insufficient SUI balance to split for gas!");
          return;
        }

        const txSplit = new Transaction();
        const [coin1, coin2] = txSplit.splitCoins(
          txSplit.object(largestCoin.coinObjectId),
          [txSplit.pure.u64(estimatedGasFee), txSplit.pure.u64(BigInt(largestCoin.balance) - estimatedGasFee)]
        );
        txSplit.transferObjects([coin1, coin2], currentAccount.address);

        signAndExecute(
          { transaction: txSplit },
          {
            onSuccess: () => console.log("Coin split successfully!"),
            onError: (error) => alert(`Split Error: ${error.message}`),
          }
        );

        coins = await client.getCoins({
          owner: currentAccount.address,
          coinType: "0x2::sui::SUI",
        });
      }

      const gasCoin = coins.data[0];
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::mechanics::claim_pet`,
        arguments: [
          tx.object(petId),
          tx.object(CONFIG_ID),
          tx.object(TOKEN_TREASURY_ID),
          tx.object(CLOCK_ID),
        ],
      });
      tx.setGasPayment([{ objectId: gasCoin.coinObjectId, version: gasCoin.version, digest: gasCoin.digest }]);

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
    } catch (error: any) {
      alert(`Claim Setup Error: ${error.message}`);
    }
  };

  const handleMintPet = async () => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }
    try {
      const config = await client.getObject({
        id: CONFIG_ID,
        options: { showContent: true },
      });
      if (!(config?.data?.content as any)?.fields?.pet_price) {
        alert("Failed to fetch pet_price from Config!");
        return;
      }
      const mintPrice = BigInt((config?.data?.content as any).fields.pet_price);

      const mintCoinObject = coinWithBalance({
        balance: mintPrice,
        useGasCoin: true
      });

      // const estimatedGasFee = BigInt(100_000_000);
      // let coins = await client.getCoins({
      //   owner: currentAccount.address,
      //   coinType: "0x2::sui::SUI",
      // });

      // if (coins.data.length < 2) {
      //   const largestCoin = coins.data.reduce((maxCoin: any, coin: any) => {
      //     const coinBalance = BigInt(coin.balance);
      //     return coinBalance > BigInt(maxCoin.balance) ? coin : maxCoin;
      //   }, coins.data[0]);

      //   if (BigInt(largestCoin.balance) < mintPrice + estimatedGasFee) {
      //     alert("Insufficient SUI balance to split and pay!");
      //     return;
      //   }

      //   const txSplit = new Transaction();
      //   const [coin1, coin2] = txSplit.splitCoins(
      //     txSplit.object(largestCoin.coinObjectId),
      //     [txSplit.pure.u64(mintPrice), txSplit.pure.u64(BigInt(largestCoin.balance) - mintPrice)]
      //   );
      //   txSplit.transferObjects([coin1, coin2], currentAccount.address);

      //   signAndExecute(
      //     { transaction: txSplit },
      //     {
      //       onSuccess: () => console.log("Coin split successfully!"),
      //       onError: (error) => alert(`Split Error: ${error.message}`),
      //     }
      //   );

      //   coins = await client.getCoins({
      //     owner: currentAccount.address,
      //     coinType: "0x2::sui::SUI",
      //   });
      // }

      // const paymentCoin = coins.data.find((coin: any) => BigInt(coin.balance) >= mintPrice + estimatedGasFee);
      // if (!paymentCoin) {
      //   alert(`Insufficient SUI balance! Need at least ${(Number(mintPrice) / 1_000_000_000 + 0.1)} SUI in a single coin.`);
      //   return;
      // }

      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      // const splitCoin = tx.splitCoins(tx.object(paymentCoin.coinObjectId), [tx.pure.u64(mintPrice)]);
      tx.moveCall({
        target: `${PACKAGE_ID}::mechanics::create_pet`,
        arguments: [
          tx.object(CONFIG_ID),
          tx.object(TREASURY_ID),
          tx.object(RANDOM_ID),
          tx.object(CLOCK_ID),
          mintCoinObject,
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
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleBuyFood = async (food: Food) => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }
    setIsBuying(true);
    try {
      const foodPrice = BigInt(Math.floor(food.food_price * 1_000_000_000));

      const foodCoinObject = coinWithBalance({
        balance: foodPrice,
        useGasCoin: true
      });
      // const estimatedGasFee = BigInt(100_000_000);
      // let coins = await client.getCoins({
      //   owner: currentAccount.address,
      //   coinType: "0x2::sui::SUI",
      // });

      // if (coins.data.length < 2) {
      //   const largestCoin = coins.data.reduce((maxCoin: any, coin: any) => {
      //     const coinBalance = BigInt(coin.balance);
      //     return coinBalance > BigInt(maxCoin.balance) ? coin : maxCoin;
      //   }, coins.data[0]);

      //   if (BigInt(largestCoin.balance) < foodPrice + estimatedGasFee) {
      //     alert("Insufficient SUI balance to split and pay!");
      //     return;
      //   }

      //   const txSplit = new Transaction();
      //   const [coin1, coin2] = txSplit.splitCoins(
      //     txSplit.object(largestCoin.coinObjectId),
      //     [txSplit.pure.u64(foodPrice), txSplit.pure.u64(BigInt(largestCoin.balance) - foodPrice)]
      //   );
      //   txSplit.transferObjects([coin1, coin2], currentAccount.address);

      //   signAndExecute(
      //     { transaction: txSplit },
      //     {
      //       onSuccess: () => console.log("Coin split successfully!"),
      //       onError: (error) => alert(`Split Error: ${error.message}`),
      //     }
      //   );
      //   coins = await client.getCoins({
      //     owner: currentAccount.address,
      //     coinType: "0x2::sui::SUI",
      //   });
      // }

      // const paymentCoin = coins.data.find((coin: any) => BigInt(coin.balance) >= foodPrice);
      // const gasCoin = coins.data.find(
      //   (coin: any) => BigInt(coin.balance) >= estimatedGasFee && coin.coinObjectId !== paymentCoin?.coinObjectId
      // );
      // if (!paymentCoin || !gasCoin) {
      //   alert(`Insufficient SUI balance! Need at least ${(Number(foodPrice) / 1_000_000_000 + 0.1)} SUI in separate coins.`);
      //   return;
      // }

      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      // const splitCoin = tx.splitCoins(tx.object(foodCoinObject), [tx.pure.u64(foodPrice)]);
      tx.moveCall({
        target: `${PACKAGE_ID}::mechanics::buy_food`,
        arguments: [
          tx.object(CONFIG_ID),
          tx.object(TREASURY_ID),
          tx.pure.u64(food.food_config_id),
          foodCoinObject,
        ],
      });
      // tx.setGasPayment([{ objectId: gasCoin.coinObjectId, version: gasCoin.version, digest: gasCoin.digest }]);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            alert(`Successfully bought ${food.food_name}!`);
            refetchFoods();
          },
          onError: (error) => alert(`Buy Food Error: ${error.message}`),
        }
      );
    } catch (error: any) {
      alert(`Buy Food Setup Error: ${error.message}`);
    } finally {
      setIsBuying(false);
    }
  };

  const handleUpgradePet = async (petId: string) => {
    if (!currentAccount) {
      alert("Please connect wallet!");
      return;
    }
    try {
      const config = await client.getObject({
        id: CONFIG_ID,
        options: { showContent: true },
      });
      if (!(config?.data?.content as any)?.fields?.pet_upgrade_base_price) {
        alert("Failed to fetch pet_upgrade_base_price from Config!");
        return;
      }
      const petUpgradeBasePrice = BigInt((config?.data?.content as any).fields.pet_upgrade_base_price);
      const petData = await client.getObject({
        id: petId,
        options: { showContent: true },
      });
      if (!(petData?.data?.content as any)?.fields?.pet_level) {
        alert("Failed to fetch pet_level from Pet!");
        return;
      }
      const petLevel = Number((petData?.data?.content as any).fields.pet_level);
      const cost = petUpgradeBasePrice + (petUpgradeBasePrice / BigInt(10) * BigInt(petLevel + 1));

      const upgradeCoinObject = coinWithBalance({
        balance: cost,
        useGasCoin: true
      });

      // const estimatedGasFee = BigInt(100_000_000);
      // let coins = await client.getCoins({
      //   owner: currentAccount.address,
      //   coinType: "0x2::sui::SUI",
      // });

      // if (coins.data.length < 2) {
      //   const largestCoin = coins.data.reduce((maxCoin: any, coin: any) => {
      //     const coinBalance = BigInt(coin.balance);
      //     return coinBalance > BigInt(maxCoin.balance) ? coin : maxCoin;
      //   }, coins.data[0]);

      //   if (BigInt(largestCoin.balance) < cost + estimatedGasFee) {
      //     alert("Insufficient SUI balance to split and pay!");
      //     return;
      //   }

      //   const txSplit = new Transaction();
      //   const [coin1, coin2] = txSplit.splitCoins(
      //     txSplit.object(largestCoin.coinObjectId),
      //     [txSplit.pure.u64(cost), txSplit.pure.u64(BigInt(largestCoin.balance) - cost)]
      //   );
      //   txSplit.transferObjects([coin1, coin2], currentAccount.address);

      //   signAndExecute(
      //     { transaction: txSplit },
      //     {
      //       onSuccess: () => console.log("Coin split successfully!"),
      //       onError: (error) => alert(`Split Error: ${error.message}`),
      //     }
      //   );

      //   coins = await client.getCoins({
      //     owner: currentAccount.address,
      //     coinType: "0x2::sui::SUI",
      //   });
      // }

      // const paymentCoin = coins.data.find((coin: any) => BigInt(coin.balance) >= cost);
      // const gasCoin = coins.data.find(
      //   (coin: any) => BigInt(coin.balance) >= estimatedGasFee && coin.coinObjectId !== paymentCoin?.coinObjectId
      // );
      // if (!paymentCoin || !gasCoin) {
      //   alert(`Insufficient SUI balance! Need at least ${(Number(cost) / 1_000_000_000 + 0.1)} SUI in separate coins.`);
      //   return;
      // }

      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      // const splitCoin = tx.splitCoins(tx.object(paymentCoin.coinObjectId), [tx.pure.u64(cost)]);
      tx.moveCall({
        target: `${PACKAGE_ID}::mechanics::upgrade_pet`,
        arguments: [
          tx.object(petId),
          tx.object(CONFIG_ID),
          tx.object(TREASURY_ID),
          upgradeCoinObject,
        ],
      });
      // tx.setGasPayment([{ objectId: gasCoin.coinObjectId, version: gasCoin.version, digest: gasCoin.digest }]);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            alert("Pet upgraded successfully!");
            refetchPets();
            refetchSelectedPetData();
          },
          onError: (error) => alert(`Upgrade Error: ${error.message}`),
        }
      );
      // Nếu signAndExecute không hoạt động, thay bằng:
      // await client.signAndExecuteTransactionBlock({
      //     signer: currentAccount,
      //     transactionBlock: tx,
      //     options: { showEffects: true },
      //     requestType: "WaitForLocalExecution",
      // });
    } catch (error: any) {
      alert(`Upgrade Setup Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900/50 to-teal-900/50 backdrop-blur-xl text-white font-sans">
      {/* Navbar */}
      <nav className="bg-blue-800/30 backdrop-blur-lg p-4 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center px-4 md:px-40">
          <div className="flex space-x-4">
            {["Pets", "Market", "Battle"].map((tab) => (
              <button
                key={tab}
                className={`px-5 py-2 rounded-full transition-all duration-300 font-medium ${activeTab === tab
                  ? "bg-teal-600 text-white shadow-lg"
                  : "bg-transparent hover:bg-teal-500/50 text-gray-200"
                  } ${tab === "Battle" ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => tab !== "Battle" && setActiveTab(tab as "Pets" | "Market" | "Battle")}
                disabled={tab === "Battle"}
              >
                {tab}
                {tab === "Battle" && " (Coming soon)"}
              </button>
            ))}
          </div>
          <ConnectButton className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full transition-all duration-300 font-medium" />
        </div>
      </nav>

      {/* Feed Modal */}
      {isFeedModalOpen && selectedPet && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-blue-900/90 backdrop-blur-lg p-6 rounded-xl border border-teal-500/30 shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 hover:scale-105">
            <h3 className="text-2xl font-bold text-teal-300 mb-6">Select Food to Feed</h3>
            {ownedFoodsParsed.length ? (
              <div className="space-y-4 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-blue-900/50">
                {ownedFoodsParsed.map((food) => (
                  <div
                    key={food.id}
                    className="p-4 bg-blue-800/30 rounded-lg border border-teal-600/30 cursor-pointer hover:bg-blue-700/40 transition-all duration-200 flex items-center space-x-4"
                    onClick={() => handleFeedPet(selectedPet, food.id)}
                  >
                    <img
                      src={foodImages[food.food_name.toLowerCase()] || "/assets/placeholder.png"}
                      alt={food.food_name}
                      className="w-16 h-16 object-contain rounded-md"
                    />
                    <div>
                      <p className="text-gray-200 font-semibold">{food.food_name}</p>
                      <p className="text-gray-300 text-sm">Type: {food.food_type}</p>
                      <p className="text-gray-300 text-sm">Level: {food.food_level}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No foods available in your inventory.</p>
            )}
            <button
              className="mt-6 bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 transition-all duration-300 w-full font-medium"
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
              <h2 className="text-3xl font-bold mb-6 text-teal-300 drop-shadow-lg">Your Pets</h2>
              {!currentAccount ? (
                <p className="text-center text-lg text-gray-300">Please connect wallet to view Pets.</p>
              ) : ownerPets?.data.length === 0 ? (
                <p className="text-gray-400">No pets found. Try minting one!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ownerPets?.data.map((obj) => {
                    const pet = (obj.data?.content as any).fields;
                    const petName = pet.pet_name ? Buffer.from(pet.pet_name).toString("utf8").toLowerCase() : "unknown";
                    return (
                      <div
                        key={obj.data?.objectId}
                        className={`p-5 bg-blue-800/30 backdrop-blur-md rounded-xl cursor-pointer transition-all duration-300 border border-teal-500/30 ${selectedPet === obj.data?.objectId ? "shadow-xl border-teal-400/50" : "hover:shadow-lg hover:bg-blue-700/40"
                          }`}
                        onClick={() => setSelectedPet(obj.data?.objectId!)}
                      >
                        <img
                          src={petImages[petName] || "/assets/placeholder.png"}
                          alt={petName}
                          className="w-32 h-32 object-contain mx-auto mb-4 rounded-md"
                        />
                        <p className="text-lg font-semibold text-teal-200">
                          {pet.pet_name ? Buffer.from(pet.pet_name).toString("utf8").toLowerCase() : "unknown"}
                        </p>
                        <p className="text-gray-300">Level: {pet.pet_level}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedPet && selectedPetData && (
              <div className="p-6 bg-blue-900/30 backdrop-blur-lg rounded-xl border border-teal-500/30 shadow-xl">
                <h2 className="text-2xl font-bold text-teal-300 mb-4 drop-shadow-lg">Pet Details</h2>
                <div className="flex flex-col items-center space-y-4">
                  <img
                    src={
                      petImages[
                      (selectedPetData.data?.content as any).fields.pet_name
                        ? Buffer.from((selectedPetData.data?.content as any).fields.pet_name)
                          .toString("utf8")
                          .toLowerCase()
                        : "unknown"
                      ] || "/assets/placeholder.png"
                    }
                    alt="Selected Pet"
                    className="w-40 h-40 object-contain rounded-md"
                  />
                  <div className="space-y-3 text-gray-200 text-center">
                    <p>
                      <span className="font-semibold text-teal-200">Name:</span>{" "}
                      {(selectedPetData.data?.content as any).fields.pet_name
                        ? Buffer.from((selectedPetData.data?.content as any).fields.pet_name)
                          .toString("utf8")
                          .toLowerCase()
                        : "unknown"}
                    </p>
                    <p>
                      <span className="font-semibold text-teal-200">Type:</span>{" "}
                      {(selectedPetData.data?.content as any).fields.pet_type
                        ? Buffer.from((selectedPetData.data?.content as any).fields.pet_type)
                          .toString("utf8")
                          .toLowerCase()
                        : "unknown"}
                    </p>
                    <p>
                      <span className="font-semibold text-teal-200">Level:</span>{" "}
                      {(selectedPetData.data?.content as any).fields.pet_level}
                    </p>
                    <p>
                      <span className="font-semibold text-teal-200">Total Earned:</span>{" "}
                      {((selectedPetData.data?.content as any).fields.total_earned_amount) / 1e9 || 0} SPGT
                    </p>
                    <p>
                      <span className="font-semibold text-teal-200">Time until hungry:</span>{" "}
                      {getTimeLeft((selectedPetData.data?.content as any).fields.hungry_timestamp_ms)}
                    </p>
                    <p>
                      <span className="font-semibold text-teal-200">Tokens earning:</span>{" "}
                      <span className="text-teal-400 font-bold">{earnedTokens[selectedPet]?.toFixed(7) || 0} SPGT</span>
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <button
                    className="bg-teal-600 text-white px-6 py-2 rounded-full hover:bg-teal-700 transition-all duration-300 shadow-md font-medium"
                    onClick={() => handleClaim(selectedPet)}
                  >
                    Claim
                  </button>
                  <button
                    className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition-all duration-300 shadow-md font-medium"
                    onClick={() => setIsFeedModalOpen(true)}
                  >
                    Feed Pet
                  </button>
                  <button
                    className="bg-purple-600 text-white px-6 py-2 rounded-full hover:bg-purple-700 transition-all duration-300 shadow-md font-medium"
                    onClick={() => handleUpgradePet(selectedPet)}
                  >
                    Upgrade
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
                  className={`px-5 py-2 rounded-full transition-all duration-300 font-medium ${activeMarketSection === section
                    ? "bg-teal-600 text-white shadow-md"
                    : "bg-blue-800/30 hover:bg-teal-500/30 text-gray-200 border border-teal-500/30"
                    }`}
                  onClick={() => setActiveMarketSection(section as "Foods" | "Mint")}
                >
                  {section}
                </button>
              ))}
            </div>

            {activeMarketSection === "Foods" && (
              <div>
                <h2 className="text-3xl font-bold mb-6 text-teal-300 drop-shadow-lg">Available Foods</h2>
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
                        className="p-5 bg-blue-800/30 backdrop-blur-md rounded-xl border border-teal-500/30 shadow-md hover:shadow-lg hover:bg-blue-700/40 transition-all duration-200"
                      >
                        <img
                          src={foodImages[food.food_name.toLowerCase()] || "/assets/placeholder.png"}
                          alt={food.food_name}
                          className="w-24 h-24 object-contain mx-auto mb-4 rounded-md"
                        />
                        <p className="text-gray-200 font-semibold">{food.food_name}</p>
                        <p className="text-gray-300 text-sm">Type: {food.food_type}</p>
                        <p className="text-gray-300 text-sm">Level: {food.food_level}</p>
                        <p className="text-gray-300 text-sm">Price: {food.food_price} SUI</p>
                        <button
                          className="mt-4 bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition-all duration-300 shadow-md w-full font-medium"
                          onClick={() => handleBuyFood(food)}
                          disabled={isBuying}
                        >
                          {isBuying ? "Buying..." : "Buy"}
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
              <div className="p-6 bg-blue-900/30 backdrop-blur-lg rounded-xl border border-teal-500/30 shadow-xl">
                <h2 className="text-3xl font-bold mb-6 text-teal-300 drop-shadow-lg">Mint New Pet</h2>
                <button
                  className="bg-teal-600 text-white px-6 py-2 rounded-full hover:bg-teal-700 transition-all duration-300 shadow-md font-medium"
                  onClick={handleMintPet}
                >
                  Mint Pet ({(config?.data?.content as any)?.fields?.pet_price ? Number((config?.data?.content as any)?.fields?.pet_price) / 1e9 : 'Unknown'} SUI)
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "Battle" && (
          <div className="text-center p-6 bg-blue-900/30 backdrop-blur-lg rounded-xl border border-teal-500/30 shadow-xl">
            <h3 className="text-3xl font-bold text-teal-300 drop-shadow-lg">Battle (Coming Soon)</h3>
            <p className="text-lg text-gray-400 mt-4">Stay tuned for epic battles!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;