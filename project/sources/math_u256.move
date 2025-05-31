module project::liquidity_pool {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    public struct Pool has key, store {
        id: UID,
        token_a: u128,
        token_b: u128,
        liquidity: u256,
    }

    public entry fun create_pool(ctx: &mut TxContext) {
        let pool = Pool {
            id: object::new(ctx),
            token_a: 0,
            token_b: 1000000,
            liquidity: 0u256,
        };
        transfer::transfer(pool, tx_context::sender(ctx));
    }

    public fun get_token_b(pool: &Pool): u128 {
        pool.token_b
    }

    public fun checked_shlw(n: u256): (u256, bool) {
        // let mask = 0xffffffffffffffff << 192;
        if (n > 115792089237316195417293883273301227089434195242432897623355228563449095127040) {
            (0, true)
        } else {
            ((n << 64), false)
        }
    }

    public fun add_liquidity(pool: &mut Pool, token_a_amount: u256): u256 {
        let (liquidity, overflow) = checked_shlw(token_a_amount);
        assert!(!overflow, 1000);
        pool.liquidity = pool.liquidity + liquidity;
        liquidity
    }

    public fun remove_liquidity(pool: &mut Pool, lp_tokens: u256): u128 {
        assert!(pool.liquidity >= lp_tokens, 1001);
        pool.liquidity = pool.liquidity - lp_tokens;
        let max_u128 = 0xffffffffffffffffu128; // 2^64 - 1
        let shifted = lp_tokens >> 64u8; // Dịch phải để lấy giá trị gốc
        let withdrawn = if (shifted > (max_u128 as u256)) {
            max_u128
        } else {
            (shifted as u128)
        };
        if (withdrawn > pool.token_b) {
            pool.token_b = 0;
        } else {
            pool.token_b = pool.token_b - withdrawn;
        };
        withdrawn
    }

    public fun exploit(pool: &mut Pool, token_a_amount: u256): u128 {
        let lp_tokens = add_liquidity(pool, token_a_amount);
        remove_liquidity(pool, lp_tokens)
    }
}