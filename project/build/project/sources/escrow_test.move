#[test_only]
module project::escrow_test {
    use sui::test_scenario;
    use project::escrow::{Self, Item, Key, Escrow};
    use sui::object;
    use sui::tx_context;
    use sui::transfer;

    // Định nghĩa mã lỗi để so sánh
    const EWrongRecipient: u64 = 0;
    const EWrongKey: u64 = 1;
    const EWrongCancelRecipient: u64 = 2;

    #[test]
    fun test_create_escrow() {
        let admin = @0xA;
        let recipient = @0xB;
        let mut scenario_val = test_scenario::begin(admin);
        let scenario = &mut scenario_val;

        // Tạo Item
        let item = escrow::create_item(100, test_scenario::ctx(scenario));

        // Tạo Escrow và Key
        escrow::create_escrow(item, recipient, test_scenario::ctx(scenario));

        // Kiểm tra: Escrow được tạo (shared object), Key được gửi cho recipient
        test_scenario::next_tx(scenario, recipient);
        assert!(test_scenario::has_most_recent_for_address<Key>(recipient), 0);
        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_swap_success() {
        let admin = @0xA;
        let recipient = @0xB;
        let mut scenario_val = test_scenario::begin(admin);
        let scenario = &mut scenario_val;

        // Tạo Item và Escrow
        let item = escrow::create_item(100, test_scenario::ctx(scenario));
        escrow::create_escrow(item, recipient, test_scenario::ctx(scenario));

        // Recipient thực hiện swap
        test_scenario::next_tx(scenario, recipient);
        let key = test_scenario::take_from_sender<Key>(scenario);
        let escrow = test_scenario::take_shared<Escrow<Item>>(scenario);
        escrow::swap(escrow, key, test_scenario::ctx(scenario));

        // Kiểm tra: Item được chuyển cho recipient, Key và Escrow bị xóa
        assert!(test_scenario::has_most_recent_for_address<Item>(recipient), 0);
        assert!(!test_scenario::has_most_recent_shared<Escrow<Item>>(), 1);
        assert!(!test_scenario::has_most_recent_for_address<Key>(recipient), 2);

        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_multiple_keys() {
        let admin1 = @0xA;
        let admin2 = @0xC;
        let recipient = @0xB;
        let mut scenario_val = test_scenario::begin(admin1);
        let scenario = &mut scenario_val;

        // Admin1 tạo Item và Escrow
        let item1 = escrow::create_item(100, test_scenario::ctx(scenario));
        let escrow_id1 = object::id(&item1); // Lưu ID của Escrow từ Item
        escrow::create_escrow(item1, recipient, test_scenario::ctx(scenario));

        // Admin2 tạo Item và Escrow khác
        test_scenario::next_tx(scenario, admin2);
        let item2 = escrow::create_item(200, test_scenario::ctx(scenario));
        escrow::create_escrow(item2, recipient, test_scenario::ctx(scenario));

        // Recipient lấy đúng Key và Escrow
        test_scenario::next_tx(scenario, recipient);
        let mut key_id = test_scenario::most_recent_id_for_address<Key>(recipient);
        let key1 = test_scenario::take_from_address_by_id<Key>(
            scenario,
            recipient,
            option::extract(&mut key_id) // Trích xuất ID từ Option<ID>
        );
        let escrow1 = test_scenario::take_shared_by_id<Escrow<Item>>(scenario, escrow_id1);
        escrow::swap(escrow1, key1, test_scenario::ctx(scenario));

        // Kiểm tra: Recipient nhận Item từ Escrow đầu tiên
        assert!(test_scenario::has_most_recent_for_address<Item>(recipient), 0);
        assert!(!test_scenario::has_most_recent_for_address<Key>(recipient), 1);

        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EWrongRecipient)]
    fun test_swap_wrong_recipient() {
        let admin = @0xA;
        let recipient = @0xB;
        let wrong_recipient = @0xC;
        let mut scenario_val = test_scenario::begin(admin);
        let scenario = &mut scenario_val;

        // Tạo Item và Escrow
        let item = escrow::create_item(100, test_scenario::ctx(scenario));
        escrow::create_escrow(item, recipient, test_scenario::ctx(scenario));

        // Người không phải recipient cố swap
        test_scenario::next_tx(scenario, wrong_recipient);
        let key = test_scenario::take_from_address<Key>(scenario, recipient);
        let escrow = test_scenario::take_shared<Escrow<Item>>(scenario);
        escrow::swap(escrow, key, test_scenario::ctx(scenario));

        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_cancel() {
        let admin = @0xA;
        let recipient = @0xB;
        let mut scenario_val = test_scenario::begin(admin);
        let scenario = &mut scenario_val;

        // Tạo Item và Escrow
        let item = escrow::create_item(100, test_scenario::ctx(scenario));
        escrow::create_escrow(item, recipient, test_scenario::ctx(scenario));

        // Recipient hủy Escrow
        test_scenario::next_tx(scenario, recipient);
        let escrow = test_scenario::take_shared<Escrow<Item>>(scenario);
        escrow::cancel(escrow, test_scenario::ctx(scenario));

        // Kiểm tra: Item được trả lại cho recipient, Escrow bị xóa
        assert!(test_scenario::has_most_recent_for_address<Item>(recipient), 0);
        assert!(!test_scenario::has_most_recent_shared<Escrow<Item>>(), 1);

        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EWrongCancelRecipient)]
    fun test_cancel_wrong_recipient() {
        let admin = @0xA;
        let recipient = @0xB;
        let wrong_recipient = @0xC;
        let mut scenario_val = test_scenario::begin(admin);
        let scenario = &mut scenario_val;

        // Tạo Item và Escrow
        let item = escrow::create_item(100, test_scenario::ctx(scenario));
        escrow::create_escrow(item, recipient, test_scenario::ctx(scenario));

        // Người không phải recipient cố hủy
        test_scenario::next_tx(scenario, wrong_recipient);
        let escrow = test_scenario::take_shared<Escrow<Item>>(scenario);
        escrow::cancel(escrow, test_scenario::ctx(scenario));

        test_scenario::end(scenario_val);
    }
}