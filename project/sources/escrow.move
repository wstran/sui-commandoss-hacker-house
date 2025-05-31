module project::escrow {
    // Struct đại diện cho Item
    public struct Item has key, store {
        id: object::UID,
        value: u64,
    }

    // Struct đại diện cho Key (chứng nhận mở khóa)
    public struct Key has key, store {
        id: object::UID,
        escrow_id: object::ID,
    }

    // Struct đại diện cho Escrow (shared object)
    public struct Escrow<T: key + store> has key {
        id: object::UID,
        item: T,
        recipient: address,
    }

    // Tạo Item mới
    public fun create_item(value: u64, ctx: &mut tx_context::TxContext): Item {
        Item {
            id: object::new(ctx),
            value,
        }
    }

    // Tạo Escrow và khóa Item, trả về Key
    public entry fun create_escrow<T: key + store>(
        item: T,
        recipient: address,
        ctx: &mut tx_context::TxContext
    ) {
        let escrow_id = object::new(ctx);
        let escrow = Escrow {
            id: escrow_id,
            item,
            recipient,
        };
        let key = Key {
            id: object::new(ctx),
            escrow_id: object::uid_to_inner(&escrow.id),
        };
        // Chuyển Escrow thành shared object
        transfer::share_object(escrow);
        // Chuyển Key cho recipient
        transfer::public_transfer(key, recipient);
    }

    // Swap để đổi Item bằng Key
    public entry fun swap<T: key + store>(
        escrow: Escrow<T>,
        key: Key,
        ctx: &tx_context::TxContext
    ) {
        // Kiểm tra recipient
        assert!(escrow.recipient == tx_context::sender(ctx), 0);
        // Kiểm tra Key khớp với Escrow
        assert!(key.escrow_id == object::uid_to_inner(&escrow.id), 1);
        // Xóa Key
        let Key { id, escrow_id: _ } = key;
        object::delete(id);
        // Lấy Item và xóa Escrow
        let Escrow { id, item, recipient: _ } = escrow;
        object::delete(id);
        // Chuyển Item cho người gọi
        transfer::public_transfer(item, tx_context::sender(ctx));
    }

    // Hủy Escrow và lấy lại Item
    public entry fun cancel<T: key + store>(
        escrow: Escrow<T>,
        ctx: &tx_context::TxContext
    ) {
        // Kiểm tra người gọi là recipient
        assert!(escrow.recipient == tx_context::sender(ctx), 2);
        let Escrow { id, item, recipient: _ } = escrow;
        object::delete(id);
        // Chuyển Item cho người gọi
        transfer::public_transfer(item, tx_context::sender(ctx));
    }
}