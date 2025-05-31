import {
	ConnectButton,
	useCurrentAccount,
	useSuiClientQuery,
	useSuiClientQueries,
	useSuiClientInfiniteQuery,
	useResolveSuiNSName,
	useSuiClientMutation,
	ConnectModal,
	useAccounts,
	useAutoConnectWallet,
	useWallets,
	useConnectWallet,
	useCurrentWallet,
	useDisconnectWallet,
	useReportTransactionEffects,
	useSuiClient,
	useSignPersonalMessage,
	useSignTransaction,
	useSwitchAccount
} from '@mysten/dapp-kit';
import { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

function UseOnlyWallets() {
	const wallets = useWallets();

	return (
		<div>
			<h2>Installed wallets</h2>
			{wallets.length === 0 && <div>No wallets installed</div>}
			<ul>
				{wallets.map((wallet) => (
					<li key={wallet.name}>{wallet.name}</li>
				))}
			</ul>
		</div>
	);
}

function SwitchAccount() {
	const { mutate: switchAccount } = useSwitchAccount();
	const accounts = useAccounts();

	return (
		<div style={{ padding: 20 }}>
			<ConnectButton />
			<ul>
				{accounts.map((account) => (
					<li key={account.address}>
						<button
							onClick={() => {
								switchAccount(
									{ account },
									{
										onSuccess: () => console.log(`switched to ${account.address}`),
									},
								);
							}}
						>
							Switch to {account.address}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

function SignTransaction() {
	const { mutateAsync: signTransaction } = useSignTransaction();
	const [signature, setSignature] = useState('');
	const client = useSuiClient();
	const currentAccount = useCurrentAccount();

	return (
		<div style={{ padding: 20 }}>
			SignTransaction {import.meta.env.VITE_CURRENT_NETWORK}
			{currentAccount && (
				<>
					<div>
						<button
							onClick={async () => {
								try {
									const tx = new Transaction();

									tx.transferObjects(
										[tx.splitCoins(tx.gas, [tx.pure('u64', 100_000_000)])],
										'0x10b7297f85068cca632ec8ff9601a39d858f0cb5aec2fe6728ad6e8ab3ac0be1'
									);

									const { bytes, signature, reportTransactionEffects } = await signTransaction({
										transaction: tx,
										chain: `sui:${import.meta.env.VITE_CURRENT_NETWORK || 'devnet'}`,
									});

									const executeResult = await client.executeTransactionBlock({
										transactionBlock: bytes,
										signature,
										options: { showRawEffects: true },
									});

									reportTransactionEffects(executeResult.rawEffects!.toLocaleString());
									setSignature(signature);
									console.log('Kết quả:', executeResult);
								} catch (error) {
									console.error('Lỗi:', error);
								}
							}}
						>
							Sign and execute transaction
						</button>
					</div>
					<div>Signature: {signature}</div>
				</>
			)}
		</div>
	);
}

function SignPersonalMessage() {
	const { mutate: signPersonalMessage } = useSignPersonalMessage();
	const [message, setMessage] = useState('hello, World!');
	const [signature, setSignature] = useState('');
	const currentAccount = useCurrentAccount();

	return (
		<div style={{ padding: 20 }}>SignPersonalMessage
			{currentAccount && (
				<>
					<div>
						<label>
							Message:{' '}
							<input type="text" value={message} onChange={(ev) => setMessage(ev.target.value)} />
						</label>
					</div>
					<button
						onClick={() => {
							signPersonalMessage(
								{
									message: new TextEncoder().encode(message),
								},
								{
									onSuccess: (result) => setSignature(result.signature),
								},
							);
						}}
					>
						Sign message
					</button>
					<div>Signature: {signature}</div>
				</>
			)}
		</div>
	);
}

function SignAndExecuteTransaction() {
	const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
	const [digest, setDigest] = useState('');
	const currentAccount = useCurrentAccount();

	return (
		<div style={{ padding: 20 }}>SignAndExecuteTransaction
			{currentAccount && (
				<>
					<div>
						<button
							onClick={() => {
								signAndExecuteTransaction(
									{
										transaction: new Transaction(),
										chain: `sui:${import.meta.env.VITE_CURRENT_NETWORK || 'devnet'}`,
									},
									{
										onSuccess: (result) => {
											console.log('executed transaction', result);
											setDigest(result.digest);
										},
									},
								);
							}}
						>
							Sign and execute transaction
						</button>
					</div>
					<div>Digest: {digest}</div>
				</>
			)}
		</div>
	);
}

function ReportTransactionEffects() { // idk what usecase for this example
	const { mutateAsync: reportTransactionEffects } = useReportTransactionEffects();
	const [signature, setSignature] = useState('');
	const client = useSuiClient();
	const currentAccount = useCurrentAccount();

	return (
		<div style={{ padding: 20 }}>ReportTransactionEffects
			{currentAccount && (
				<>
					<div>
						<button
							onClick={async () => {
								// const { effects } = await SignAndExecuteTransaction();
								// reportTransactionEffects({ effects });
							}}
						>
							Sign empty transaction
						</button>
					</div>
					<div>Signature: {signature}</div>
				</>
			)}
		</div>
	);
}

function DisconnectWallet() {
	const { mutate: disconnect } = useDisconnectWallet();
	return (
		<div>DisconnectWallet
			<button onClick={() => disconnect()}>Disconnect</button>
		</div>
	);
}

function CurrentWallet() {
	const { currentWallet, connectionStatus } = useCurrentWallet();

	return (
		<div>CurrentWallet
			{connectionStatus === 'connected' ? (
				<div>
					<h2>Current wallet:</h2>
					<div>Name: {currentWallet.name}</div>
					<div>
						Accounts:
						<ul>
							{currentWallet.accounts.map((account) => (
								<li key={account.address}>- {account.address}</li>
							))}
						</ul>
					</div>
				</div>
			) : (
				<div>Connection status: {connectionStatus}</div>
			)}
		</div>
	);
}

function CurrentAccount() {
	const account = useCurrentAccount();

	return (
		<div>CurrentAccount
			{!account && <div>No account connected</div>}
			{account && (
				<div>
					<h2>Current account:</h2>
					<div>Address: {account.address}</div>
				</div>
			)}
		</div>
	);
}

function Wallets() {
	const wallets = useWallets();
	const { mutate: connect } = useConnectWallet();

	return (
		<div style={{ padding: 20 }}>Wallets
			<ul>
				{wallets.map((wallet) => (
					<li key={wallet.name}>
						<button
							onClick={() => {
								connect(
									{ wallet },
									{
										onSuccess: () => console.log('connected'),
									},
								);
							}}
						>
							Connect to {wallet.name}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

function AutoConnectWallet() {
	const autoConnectionStatus = useAutoConnectWallet();

	return (
		<div>AutoConnectWallet
			<div>Auto-connection status: {autoConnectionStatus}</div>
		</div>
	);
}

function UseAccounts() {
	const accounts = useAccounts();

	return (
		<div>UseAccounts
			<h2>Available accounts:</h2>
			{accounts.length === 0 && <div>No accounts detected</div>}
			<ul>
				{accounts.map((account) => (
					<li key={account.address}>- {account.address}</li>
				))}
			</ul>
		</div>
	);
}

export function CustomConnectModal() {
	const currentAccount = useCurrentAccount();
	const [open, setOpen] = useState(false); // remove = uncontrolled

	return (
		<>
			CustomConnectModal
			<ConnectModal
				trigger={
					<button disabled={!!currentAccount}> {currentAccount ? 'Connected' : 'Connect'}</button>
				}
				open={open}
				onOpenChange={(isOpen) => setOpen(isOpen)}
			/>
		</>
	);
}

function ClientMutation(tx: string | Uint8Array<ArrayBufferLike>) {
	const { mutate } = useSuiClientMutation('dryRunTransactionBlock');

	return (
		<>ClientMutation
			<button
				onClick={() => {
					mutate({
						transactionBlock: tx,
					});
				}}
			>
				Dry run transaction
			</button>
		</>
	);
}

function NSName({ address }: { address: string }) {
	const { data, isPending } = useResolveSuiNSName(address);

	if (isPending) {
		return <div>NSName: Loading...</div>;
	}

	if (data) {
		return <div>NSName: Domain name is: {data}</div>;
	}

	return <div>NSName: Domain name not found</div>;
}

function InfiniteQuery({ address }: { address: string }) {
	const { data, isPending, isError, error, isFetching, fetchNextPage, hasNextPage } =
		useSuiClientInfiniteQuery('getOwnedObjects', {
			owner: address,
		});

	if (isPending) {
		return <div>InfiniteQuery: Loading...</div>;
	}

	if (isError) {
		return <div>InfiniteQuery: Error: {error.message}</div>;
	}

	return <pre>InfiniteQuery: {JSON.stringify(data, null, 2)}</pre>;
}


function ClientQueries({ address }: { address: string }) {
	const { data, isPending, isError } = useSuiClientQueries({
		queries: [
			{
				method: 'getAllBalances',
				params: {
					owner: address,
				},
			},
			{
				method: 'queryTransactionBlocks',
				params: {
					filter: {
						FromAddress: address,
					},
				},
			},
		],
		combine: (result) => {
			return {
				data: result.map((res) => res.data),
				isSuccess: result.every((res) => res.isSuccess),
				isPending: result.some((res) => res.isPending),
				isError: result.some((res) => res.isError),
			};
		},
	});

	if (isPending) {
		return <div>ClientQueries: Loading...</div>;
	}

	if (isError) {
		return <div>FClientQueries: etching Error</div>;
	}

	return <pre>ClientQueries: {JSON.stringify(data, null, 2)}</pre>;
}

function OwnedObjects({ address }: { address: string }) {
	const { data } = useSuiClientQuery('getOwnedObjects', {
		owner: address,
	});

	if (!data) {
		return null;
	}

	return (
		<ul>OwnedObjects
			{data.data.map((object) => (
				<li key={object.data?.objectId}>
					<div onClick={() => window.open(`https://suiscan.xyz/${import.meta.env.VITE_CURRENT_NETWORK || 'devnet'}/object/${object.data?.objectId}`, '_blank')}>
						{object.data?.objectId}
					</div>
				</li>
			))}
		</ul>
	);
}

function ConnectedAccount() {
	const account = useCurrentAccount();

	if (!account) {
		return <ConnectButton />;
	}

	return (
		<div>
			<ConnectButton />
			<div>Connected to {account.address}</div>
			<UseOnlyWallets />
			<SwitchAccount />
			<SignTransaction />
			<SignPersonalMessage />
			<SignAndExecuteTransaction />
			<ReportTransactionEffects />
			<DisconnectWallet />
			<CurrentWallet />
			<CurrentAccount />
			<Wallets />
			<UseAccounts />
			<AutoConnectWallet />
			<CustomConnectModal />
			<OwnedObjects address={account.address} />
			<ClientQueries address={account.address} />
			<InfiniteQuery address={account.address} />
			<NSName address={account.address} />
		</div>
	);
}

function App() {
	return (
		<div className="App">
			<ConnectedAccount />
		</div>
	);
}

export default App
