// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module project::clock_tests;

use std::debug;
use sui::clock;

#[test]
fun creating_a_clock_and_incrementing_it() {
    let mut ctx = tx_context::dummy();
    let mut clock = clock::create_for_testing(&mut ctx);
    
    debug::print(clock.timestamp_ms().to_string().as_bytes());

    clock.increment_for_testing(42);
    assert!(clock.timestamp_ms() == 42);

    clock.set_for_testing(50);
    assert!(clock.timestamp_ms() == 50);

    clock.destroy_for_testing();
}