module suipets::config {
    use sui::table::{Self, Table};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};

    public struct AdminCap has key {
        id: UID,
        admin_cap_address: address
    }

    public struct Config has key {
        id: UID,
        pets: Table<u64, PetConfig>,
        foods: Table<u64, FoodConfig>,
        pet_price: u256,
        pet_upgrade_base_price: u256,
        hungry_secs_per_level: u64,
        earn_per_sec: u256,
        next_pet_id: u64,
        next_food_id: u64,
    }

    public struct Treasury has key {
        id: UID,
        balance: Balance<SUI>,
    }

    public struct PetConfig has store, drop {
        id: u64,
        pet_name: vector<u8>,
        pet_type: vector<u8>,
        pet_level: u64,
        max_food_level: u64,
        base_earn_level_percent: u256,
        rate: u64,
    }
    
    public struct FoodConfig has store, drop {
        id: u64,
        food_name: vector<u8>,
        food_type: vector<u8>,
        food_level: u64,
        food_price: u64,
    }

    const ENotAdmin: u64 = 0;
    const EInvalidId: u64 = 1;

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx), admin_cap_address: tx_context::sender(ctx) };
        let config = Config {
            id: object::new(ctx),
            pets: table::new(ctx),
            foods: table::new(ctx),
            pet_price: 200_000_000,
            pet_upgrade_base_price: 100_000_000,
            hungry_secs_per_level: 3600,
            earn_per_sec: 100_000,
            next_pet_id: 0,
            next_food_id: 0,
        };
        let treasury = Treasury {
            id: object::new(ctx),
            balance: balance::zero(),
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::share_object(config);
        transfer::share_object(treasury);
    }

    public fun get_pets(config: &Config): &Table<u64, PetConfig> {
        &config.pets
    }

    public fun get_foods(config: &Config): &Table<u64, FoodConfig> {
        &config.foods
    }

    public fun get_pet_price(config: &Config): u256 {
        config.pet_price
    }

    public fun get_pet_upgrade_base_price(config: &Config): u256 {
        config.pet_upgrade_base_price
    }

    public fun get_hungry_secs_per_level(config: &Config): u64 {
        config.hungry_secs_per_level
    }

    public fun get_earn_per_sec(config: &Config): u256 {
        config.earn_per_sec
    }

    public fun get_next_pet_id(config: &Config): u64 {
        config.next_pet_id
    }

    public fun get_pet_name(pet_config: &PetConfig): vector<u8> {
        pet_config.pet_name
    }

    public fun get_pet_type(pet_config: &PetConfig): vector<u8> {
        pet_config.pet_type
    }

    public fun get_max_food_level(pet_config: &PetConfig): u64 {
        pet_config.max_food_level
    }

    public fun get_base_earn_level_percent(pet_config: &PetConfig): u256 {
        pet_config.base_earn_level_percent
    }

    public fun get_rate(pet_config: &PetConfig): u64 {
        pet_config.rate
    }

    public fun get_next_food_id(food_config: &Config): u64 {
        food_config.next_food_id
    }

    public fun get_food_name(food_config: &FoodConfig): vector<u8> {
        food_config.food_name
    }

    public fun get_food_type(food_config: &FoodConfig): vector<u8> {
        food_config.food_type
    }

    public fun get_food_level(food_config: &FoodConfig): u64 {
        food_config.food_level
    }

    public fun get_food_price(food_config: &FoodConfig): u64 {
        food_config.food_price
    }

    public entry fun add_pet(
        config: &mut Config,
        cap: &AdminCap,
        pet_name: vector<u8>,
        pet_type: vector<u8>,
        pet_level: u64,
        max_food_level: u64,
        base_earn_level_percent: u256,
        rate: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        let pet_id = config.next_pet_id;
        config.next_pet_id = pet_id + 1;
        let pet_config = PetConfig {
            id: pet_id,
            pet_name,
            pet_type,
            pet_level,
            max_food_level,
            base_earn_level_percent,
            rate,
        };
        table::add(&mut config.pets, pet_id, pet_config);
    }

    public entry fun edit_pet_name(config: &mut Config, cap: &AdminCap, pet_id: u64, new_name: vector<u8>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.pets, pet_id), EInvalidId);
        let pet = table::borrow_mut(&mut config.pets, pet_id);
        pet.pet_name = new_name;
    }

    public entry fun edit_pet_type(config: &mut Config, cap: &AdminCap, pet_id: u64, new_type: vector<u8>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.pets, pet_id), EInvalidId);
        let pet = table::borrow_mut(&mut config.pets, pet_id);
        pet.pet_type = new_type;
    }

    public entry fun edit_pet_max_food_level(config: &mut Config, cap: &AdminCap, pet_id: u64, max_food_level: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.pets, pet_id), EInvalidId);
        let pet = table::borrow_mut(&mut config.pets, pet_id);
        pet.max_food_level = max_food_level;
    }

    public entry fun edit_pet_base_earn_level_percent(config: &mut Config, cap: &AdminCap, pet_id: u64, base_earn_level_percent: u256, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.pets, pet_id), EInvalidId);
        let pet = table::borrow_mut(&mut config.pets, pet_id);
        pet.base_earn_level_percent = base_earn_level_percent;
    }

    public entry fun edit_pet_rate(config: &mut Config, cap: &AdminCap, pet_id: u64, rate: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.pets, pet_id), EInvalidId);
        let pet = table::borrow_mut(&mut config.pets, pet_id);
        pet.rate = rate;
    }

    public entry fun remove_pet(config: &mut Config, cap: &AdminCap, pet_id: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.pets, pet_id), EInvalidId);
        table::remove(&mut config.pets, pet_id);
    }

    public entry fun add_food(
        config: &mut Config,
        cap: &AdminCap,
        food_name: vector<u8>,
        food_type: vector<u8>,
        food_level: u64,
        food_price: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        let food_id = config.next_food_id;
        config.next_food_id = food_id + 1;
        let food_config = FoodConfig {
            id: food_id,
            food_name,
            food_type,
            food_level,
            food_price,
        };
        table::add(&mut config.foods, food_id, food_config);
    }

    public entry fun edit_food_name(config: &mut Config, cap: &AdminCap, food_id: u64, new_name: vector<u8>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.foods, food_id), EInvalidId);
        let food = table::borrow_mut(&mut config.foods, food_id);
        food.food_name = new_name;
    }

    public entry fun edit_food_type(config: &mut Config, cap: &AdminCap, food_id: u64, new_type: vector<u8>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.foods, food_id), EInvalidId);
        let food = table::borrow_mut(&mut config.foods, food_id);
        food.food_type = new_type;
    }

    public entry fun edit_food_level(config: &mut Config, cap: &AdminCap, food_id: u64, food_level: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.foods, food_id), EInvalidId);
        let food = table::borrow_mut(&mut config.foods, food_id);
        food.food_level = food_level;
    }

    public entry fun edit_food_price(config: &mut Config, cap: &AdminCap, food_id: u64, food_price: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.foods, food_id), EInvalidId);
        let food = table::borrow_mut(&mut config.foods, food_id);
        food.food_price = food_price;
    }

    public entry fun remove_food(config: &mut Config, cap: &AdminCap, food_id: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        assert!(table::contains(&config.foods, food_id), EInvalidId);
        table::remove(&mut config.foods, food_id);
    }

    public entry fun set_pet_price(config: &mut Config, cap: &AdminCap, pet_price: u256, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        config.pet_price = pet_price;
    }

    public entry fun set_pet_upgrade_base_price(config: &mut Config, cap: &AdminCap, pet_upgrade_base_price: u256, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        config.pet_upgrade_base_price = pet_upgrade_base_price;
    }

    public entry fun set_hungry_secs_per_level(config: &mut Config, cap: &AdminCap, hungry_secs_per_level: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        config.hungry_secs_per_level = hungry_secs_per_level;
    }

    public entry fun set_earn_per_sec(config: &mut Config, cap: &AdminCap, earn_per_sec: u256, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        config.earn_per_sec = earn_per_sec;
    }

    public entry fun deposit(treasury: &mut Treasury, coin: Coin<SUI>) {
        let balance = coin::into_balance(coin);
        balance::join(&mut treasury.balance, balance);
    }

    public entry fun withdraw(treasury: &mut Treasury, cap: &AdminCap, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == cap.admin_cap_address, ENotAdmin);
        let amount = balance::value(&treasury.balance);
        let coin = coin::from_balance(balance::split(&mut treasury.balance, amount), ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }
}