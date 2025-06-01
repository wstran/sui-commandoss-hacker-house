module suipets::mechanics {
    use sui::clock::{Self, Clock};
    use sui::random::{Self, Random};
    use suipets::config::{Self, Config, Treasury};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::table;
    use suipets::token::{Self, TokenTreasury};
    use std::u64;

    public struct Pet has key, store {
        id: UID,
        pet_config_id: u64,
        pet_name: vector<u8>,
        pet_type: vector<u8>,
        pet_level: u64,
        earned_amount: u256,
        earned_balance: u256,
        base_earn_level_percent: u256,
        total_earned_amount: u256,
        hungry_timestamp_ms: u64,
        created_at_timestamp_ms: u64,
        claimed_at_timestamp_ms: u64,
    }

    public struct Food has key, store {
        id: UID,
        food_name: vector<u8>,
        food_type: vector<u8>,
        food_level: u64,
    }

    const BURN_ADDRESS: address = @0xdead;
    const EInsufficientPayment: u64 = 0;
    const EInvalidFoodId: u64 = 1;
    const ENoPetsAvailable: u64 = 2;

    public fun get_pet_id(pet: &Pet): &UID {
        &pet.id
    }

    public fun get_pet_config_id(pet: &Pet): u64 {
        pet.pet_config_id
    }

    public fun get_pet_name(pet: &Pet): vector<u8> {
        pet.pet_name
    }

    public fun get_pet_type(pet: &Pet): vector<u8> {
        pet.pet_type
    }

    public fun get_pet_level(pet: &Pet): u64 {
        pet.pet_level
    }

    public fun get_earned_amount(pet: &Pet): u256 {
        pet.earned_amount
    }

    public fun get_earned_balance(pet: &Pet): u256 {
        pet.earned_balance
    }

    public fun get_base_earn_level_percent(pet: &Pet): u256 {
        pet.base_earn_level_percent
    }

    public fun get_total_earned_amount(pet: &Pet): u256 {
        pet.total_earned_amount
    }

    public fun get_hungry_timestamp_ms(pet: &Pet): u64 {
        pet.hungry_timestamp_ms
    }

    public fun get_created_at_timestamp_ms(pet: &Pet): u64 {
        pet.created_at_timestamp_ms
    }

    public fun get_claimed_at_timestamp_ms(pet: &Pet): u64 {
        pet.claimed_at_timestamp_ms
    }

    public fun get_food_id(food: &Food): &UID {
        &food.id
    }

    public fun get_food_name(food: &Food): vector<u8> {
        food.food_name
    }

    public fun get_food_type(food: &Food): vector<u8> {
        food.food_type
    }

    public fun get_food_level(food: &Food): u64 {
        food.food_level
    }

    public entry fun pet_exists(pet: &Pet, _ctx: &TxContext): bool {
        object::id_to_address(&object::uid_to_inner(&pet.id)) != BURN_ADDRESS
    }

    public entry fun food_exists(food: &Food, _ctx: &TxContext): bool {
        object::id_to_address(&object::uid_to_inner(&food.id)) != BURN_ADDRESS
    }

    public entry fun is_valid_pet(pet: &Pet, config: &Config): bool {
        table::contains(config::get_pets(config), pet.pet_config_id) &&
        object::id_to_address(&object::uid_to_inner(&pet.id)) != BURN_ADDRESS
    }

    public entry fun is_valid_food(food: &Food, config: &Config): bool {
        let food_config_id = get_food_config_id(config, food.food_name, food.food_type, food.food_level);
        table::contains(config::get_foods(config), food_config_id) &&
        object::id_to_address(&object::uid_to_inner(&food.id)) != BURN_ADDRESS
    }

    public entry fun calculate_max_hungry_timestamp_ms(pet: &Pet, config: &Config, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock);
        let pet_config = table::borrow(config::get_pets(config), pet.pet_config_id);

        current_time + (config::get_hungry_secs_per_level(config) * 1000 * config::get_max_food_level(pet_config))
    }

    const EAmountTooLarge: u64 = 3;

    public entry fun calculate_earned_amount(pet: &Pet, config: &Config, clock: &Clock): u256 {
        let current_time = clock::timestamp_ms(clock);
        let end_time = if (current_time < pet.hungry_timestamp_ms) {
            current_time
        } else {
            pet.hungry_timestamp_ms
        };
        let time_since_claim = if (end_time > pet.claimed_at_timestamp_ms) {
            end_time - pet.claimed_at_timestamp_ms
        } else {
            0
        };
        let time_diff_sec = time_since_claim / 1000;
        let earn_rate = config::get_earn_per_sec(config) + (config::get_earn_per_sec(config) * pet.base_earn_level_percent / 100);

        ((time_diff_sec as u256) * earn_rate) + pet.earned_balance
    }

    public entry fun claim_pet(
        pet: &mut Pet,
        config: &Config,
        token_treasury: &mut TokenTreasury,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let earned = calculate_earned_amount(pet, config, clock);

        assert!(earned <= (u64::max_value!() as u256), EAmountTooLarge);

        if (earned > 0) {
            let coin = coin::mint(token::get_treasury_cap(token_treasury), (earned as u64), ctx);
            
            transfer::public_transfer(coin, tx_context::sender(ctx));

            pet.claimed_at_timestamp_ms = clock::timestamp_ms(clock);

            pet.earned_balance = 0;

            pet.total_earned_amount = pet.total_earned_amount + earned;
        }
    }

    fun get_food_config_id(config: &Config, food_name: vector<u8>, food_type: vector<u8>, food_level: u64): u64 {
        let mut i = 0;
        let foods = config::get_foods(config);
        while (i < config::get_next_food_id(config)) {
            if (table::contains(foods, i)) {
                let food_config = table::borrow(foods, i);
                if (config::get_food_name(food_config) == food_name &&
                    config::get_food_type(food_config) == food_type &&
                    config::get_food_level(food_config) == food_level) {
                    return i
                }
            };
            i = i + 1;
        };
        0
    }

    #[allow(lint(public_random))]
    public entry fun create_pet(
        config: &Config,
        treasury: &mut Treasury,
        random: &Random,
        clock: &Clock,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!((coin::value(&payment) as u256) >= config::get_pet_price(config), EInsufficientPayment);

        let payment_balance = coin::into_balance(payment);

        config::deposit(treasury, coin::from_balance(payment_balance, ctx));

        let mut total_rate = 0;
        let mut i = 0;

        while (i < config::get_next_pet_id(config)) {
            if (table::contains(config::get_pets(config), i)) {
                let pet_config = table::borrow(config::get_pets(config), i);
                if (config::get_rate(pet_config) > 0) {
                    total_rate = total_rate + config::get_rate(pet_config);
                }
            };
            i = i + 1;
        };

        assert!(total_rate > 0, ENoPetsAvailable);

        let mut generator = random::new_generator(random, ctx);
        let r = random::generate_u64_in_range(&mut generator, 0, total_rate - 1);
        let mut cumulative = 0;
        let mut selected_pet_id = 0;

        i = 0;

        while (i < config::get_next_pet_id(config)) {
            if (table::contains(config::get_pets(config), i)) {
                let pet_config = table::borrow(config::get_pets(config), i);
                if (config::get_rate(pet_config) > 0) {
                    cumulative = cumulative + config::get_rate(pet_config);
                    if (r < cumulative) {
                        selected_pet_id = i;
                        break
                    }
                }
            };
            i = i + 1;
        };

        let pet_config = table::borrow(config::get_pets(config), selected_pet_id);
        let current_time = clock::timestamp_ms(clock);
        let hungry_time = current_time + (config::get_hungry_secs_per_level(config) * 1000 * config::get_max_food_level(pet_config));
        let pet = Pet {
            id: object::new(ctx),
            pet_config_id: selected_pet_id,
            pet_name: config::get_pet_name(pet_config),
            pet_type: config::get_pet_type(pet_config),
            pet_level: 0,
            earned_amount: 0,
            earned_balance: 0,
            base_earn_level_percent: config::get_base_earn_level_percent(pet_config),
            total_earned_amount: 0,
            hungry_timestamp_ms: hungry_time,
            created_at_timestamp_ms: current_time,
            claimed_at_timestamp_ms: current_time,
        };

        transfer::public_transfer(pet, tx_context::sender(ctx));
    }

    public entry fun buy_food(
        config: &Config,
        treasury: &mut Treasury,
        food_id: u64,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(config::get_foods(config), food_id), EInvalidFoodId);
        let food_config = table::borrow(config::get_foods(config), food_id);
        assert!(coin::value(&payment) >= config::get_food_price(food_config), EInsufficientPayment);
        let payment_balance = coin::into_balance(payment);
        config::deposit(treasury, coin::from_balance(payment_balance, ctx));

        let food = Food {
            id: object::new(ctx),
            food_name: config::get_food_name(food_config),
            food_type: config::get_food_type(food_config),
            food_level: config::get_food_level(food_config),
        };
        transfer::public_transfer(food, tx_context::sender(ctx));
    }

    public entry fun feed_pet(
        pet: &mut Pet,
        food: Food,
        config: &Config,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        let end_time = if (current_time < pet.hungry_timestamp_ms) {
            current_time
        } else {
            pet.hungry_timestamp_ms
        };
        let time_since_claim = if (end_time > pet.claimed_at_timestamp_ms) {
            end_time - pet.claimed_at_timestamp_ms
        } else {
            0
        };
        let time_diff_sec = time_since_claim / 1000;

        let base_earn_rate = config::get_earn_per_sec(config) / 1_000_000_000;
        let earn_rate = base_earn_rate + (base_earn_rate * pet.base_earn_level_percent / 100);
        let earned = ((time_diff_sec as u256) * earn_rate) / 1_000_000_000;

        assert!(earned <= (u64::max_value!() as u256), EAmountTooLarge);

        pet.earned_balance = pet.earned_balance + earned;
        pet.total_earned_amount = pet.total_earned_amount + earned;
        pet.claimed_at_timestamp_ms = current_time;

        let pet_config = table::borrow(config::get_pets(config), pet.pet_config_id);
        let additional_time_ms = config::get_hungry_secs_per_level(config) * 1000 * food.food_level;
        let max_hungry_time = current_time + (config::get_hungry_secs_per_level(config) * 1000 * config::get_max_food_level(pet_config));

        let new_hungry_time = pet.hungry_timestamp_ms + additional_time_ms;
        pet.hungry_timestamp_ms = if (new_hungry_time > max_hungry_time) {
            max_hungry_time
        } else {
            pet.hungry_timestamp_ms + additional_time_ms
        };

        transfer::public_transfer(food, BURN_ADDRESS);
    }

    public entry fun upgrade_pet(
        pet: &mut Pet,
        config: &Config,
        treasury: &mut Treasury,
        payment: Coin<SUI>,
        _ctx: &mut TxContext
    ) {
        let cost = config::get_pet_upgrade_base_price(config) + (config::get_pet_upgrade_base_price(config) / 10 * (pet.pet_level as u256 + 1));
        assert!((coin::value(&payment) as u256) >= cost, EInsufficientPayment);
        let payment_balance = coin::into_balance(payment);
        config::deposit(treasury, coin::from_balance(payment_balance, _ctx));

        pet.pet_level = pet.pet_level + 1;
        let pet_config = table::borrow(config::get_pets(config), pet.pet_config_id);
        pet.base_earn_level_percent = pet.base_earn_level_percent + (pet.base_earn_level_percent / 100 * config::get_base_earn_level_percent(pet_config));
    }
}