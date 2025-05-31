module suipets::token {
    use sui::coin::{Self, TreasuryCap};

    public struct TOKEN has drop {}

    public struct TokenTreasury has key {
        id: UID,
        cap: TreasuryCap<TOKEN>,
    }

    fun init(witness: TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9,
            b"SPGT",
            b"SuiPet Game Token",
            b"Game Token for SuiPets",
            option::none(),
            ctx
        );

        transfer::share_object(TokenTreasury {
            id: object::new(ctx),
            cap: treasury_cap,
        });

        transfer::public_freeze_object(metadata);
    }

    public(package) fun get_treasury_cap(treasury: &mut TokenTreasury): &mut TreasuryCap<TOKEN> {
        &mut treasury.cap
    }
}