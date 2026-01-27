# SperaxOS

Smart Agent Infrastructure for Decentralized Finance.

**The End of Middlemen. The Birth of Financial Autonomy.**

Imagine a world where you never need a banker, broker, or financial advisor again.

Where your finances run on logic, not paperwork.

Where you are in full control.

**SperaxOS** is that world.

It’s not just another crypto app. It’s an AI-powered financial operating system that replaces middlemen with autonomous agents. Built on smart contracts and real-time logic, it empowers users to earn, invest, and manage capital without intermediaries.

No friction.

No gatekeepers.

No hidden fees.

Just smart contracts working for you—24/7.

***

### **Why SperaxOS?**

**SperaxOS** empowers you to:

* **Earn passive income** with yield-bearing stablecoins
* **Send money globally** in seconds
* **Invest, lend, and manage assets** without intermediaries
* **Access tools** previously reserved for institutions
* **Automate your finances**—from wills to complex trades

All powered by AI agents and transparent code.

No approvals needed. No trust required.

***

### **Key Benefits**

* **No gatekeepers** — Full financial control
* **Always earning** — Idle capital deployed automatically
* **Global-ready** — Cross-chain, borderless, and instant
* **AI-driven** — Smarter decisions, faster execution
* **Institutional tools for everyone** — No-code, plug-and-play agents

***

### **What Agents Can Do**

| **Feature**                  | **Description**                                                           |
| ---------------------------- | ------------------------------------------------------------------------- |
| **Programmable Logic**       | Set goals like “maintain 5% yield” or “automate monthly payments”         |
| **Autonomous Yield Farming** | Agents find and rebalance into best opportunities in DeFi and RWA markets |
| **Automated Payments**       | Scheduled, conditional, and metered payments — all in $USDs               |
| **Token Sniping Engine**     | Detect, evaluate, and act on new token listings in real time              |
| **Idle Capital Deployment**  | Auto-invest idle funds; maintain custom liquidity buffers                 |
| **Risk Control Layer**       | Built-in limits, safety scores, depeg alerts, and bridge risk protections |

***

### **Built on Experience**

Founded in 2019, Sperax has weathered every market cycle—and come out stronger.

We’ve built reliable products and earned the trust of top-tier investors and exchanges.

#### **🛡️ 2021: USDs**

A fully on-chain, yield-generating stablecoin—launched before many of today’s leading models.

#### **🧰 2022: Demeter**

A no-code toolkit that helps DAOs deploy liquidity farms across major DEXs, with zero developer effort.

#### **🌉 Ongoing: Bridging Web2 + Web3**

Partnered with regulated fintech app **Streetbeat** to bring decentralized finance to traditional users.

***

### **Who It’s For**

* **Users**: Hands-free, high-yield finance with full transparency
* **Developers**: Build plug-ins and custom agents using open SDK
* **Protocols**: Tap into intelligent, autonomous capital to boost liquidity

***

### **Join the Autonomous Finance Movement**

No approvals. No middlemen. Just programmable, intelligent capital.


# USDs (Sperax USD)

A stablecoin yield aggregator on the Arbitrum network

USDs is a [stablecoin](https://www.investopedia.com/terms/s/stablecoin.asp) yield aggregator which generates auto-yield natively. Currently, USDs is live on Arbitrum, the largest Layer-2 Ecosystem of Ethereum. Eventually, Sperax will build a system of interoperability so that USDs will be natively deployed to all major blockchain platforms.

**The highlights of this protocol:**

1. **Auto-yield** - Users holding USDs in their wallets automatically earn organic yield. No staking is required by the end user. Users do not need to spend gas calling the smart contract to claim their yield.
2. **Layer 2 native** — Cheaper transaction fees on Arbitrum make this protocol retail investor-friendly.
3. **Fully Backed Model** - USDs is 100% backed by a diversified basket of whitelisted crypto assets (stablecoins).

The rise of decentralized finance (DeFi) has led to a huge increase in the use of stablecoins—cryptocurrencies designed to keep a steady value, usually around $1.

They generally fall into three categories. Fiat-backed stablecoins like USDC, etc. are pegged to traditional currencies and backed by reserves held by centralized issuers. They’re widely used but raise concerns around transparency and control. Crypto-collateralized stablecoins like DAI are backed by on-chain assets. They aim for decentralization but can face scaling limits. Algorithmic stablecoins rely on smart contracts and supply adjustments to maintain their peg without direct collateral. They remain sensitive to market shifts and are still evolving.

Each type balances trade-offs between decentralization, stability, and scalability as the stablecoin ecosystem matures.

USDs has combined the best of existing designs by featuring a 100% backed model like the CDP stablecoins but adds the scalability benefits of fiat backed stablecoins. An on-chain, redemption-based design makes USDs highly scalable, trustless and decentralized.

USDs automates the process of earning yield on stablecoins. Yield is generated organically by sending collateral to audited decentralized finance protocols. 70% of yield generated on collateral is used to pay USDs holders auto-yield. Please refer to [SIP-66](https://snapshot.box/#/s:speraxdao.eth/proposal/0x401841b87ef3b503e8732eaace2b867faab15b91383e94bad9c90ec61e2540cd) for more details.

USDs auto-yield rate is adjustable and depends on the actual yield generated by the collaterals. Any yield generated beyond the max auto-yield rate will be stored in auto-yield reserves. This novel passive income strategy does not require any action from the user. Users can just hold USDs and see wallet balance grow, auto-compounding the yield in the process.

SPA is the value accrual token of the Sperax ecosystem. SPA holders can stake SPA tokens to receive veSPA. veSPA holders are decision makers of the protocol. They will earn staking rewards and manage the protocol revenue via voting power in Sperax governance. Off-chain governance is live on [Snapshot](https://snapshot.box/#/s:speraxdao.eth/proposals), and community (veSPA holders) can control parameters of USDs protocol, yield strategies, eligible collateral, new product features, etc. On-chain governance will be launched soon making veSPA holders the true owners of the Sperax ecosystem.

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FtDLKPkEcYS9NoKKBUEFs%2F77491109.png?alt=media&#x26;token=3d567fc0-5455-45b2-9b4d-a35acb6eb999" alt=""><figcaption><p>How Sperax USD (USDs) Works</p></figcaption></figure>


# Minting and Redeeming

### **Minting USDs**

To mint new USDs, minters only need eligible collateral. Currently, the protocol is accepting USDC.e, USDC and USDT as collateral and more tokens might be added to this list in the future. However, USDs tokens are fungible and redeemable in the same way, independent of their underlying minting collateral. It acts as an IOU on the pooled collateral.

The protocol will mint 1 USDs by collecting 1 USD worth of collateral.

**Collateral tokens required = No. of USDs tokens minted/Min (Price of collateral in USD, 1 USD)**

When a collateral token is worth less than 1 dollar, it will be treated with its actual market price. However, when it is worth more than 1 dollar, it will be treated as 1 dollar. Hence, USDs will always be fully collateralized or over-collateralized.

**Mint fees** are subject to Sperax DAO approval.

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2Fb02SEbUndi28ZDZ8a0ft%2FFrame%20146824%20(1).png?alt=media&#x26;token=e5a2adb4-103c-41e3-bcdf-38650e86bb93" alt=""><figcaption></figcaption></figure>

### Redeeming USDs

Redeeming 1 USDs at the protocol level gives the user back any one unit of collateral (maximum 1 unit of collateral) after deducting the redemption fee. Redeemers can choose from the list of eligible collaterals that they want to receive. A portion of USDs redeemed is collected as a redemption fee by the protocol.

The protocol will redeem 1 USDs following this simple equation:

$$
Collateral = USDs - Fee
$$

Fee = x% of USDs amount redeemed. 'x' depends on the selected collateral.&#x20;

**Collateral tokens redeemed = (1-x)% \* (No. of USDs redeemed)**&#x20;

When a collateral token is worth more than 1 dollar, it will be treated with its actual market price. However, when it is worth less than 1 dollar, it will be treated as 1 dollar. Hence, USDs will always be fully collateralized or over-collateralized.

The aggregate collateral ratio (or CR = Total Value Locked/USDs Circulating Supply) should be close to 100% as USDs are backed by stablecoins and collateral is expected to hold their price even in situations of market volatility. However, in an extreme situation if the value of locked collateral changes and the collateral ratio drops by more than 10%, the protocol will be paused manually. Redemptions will begin based on governance or if the collateral ratio increases. To cover any gaps in collateralization SPA reserves from Treasury may be used by the protocol. &#x20;

**Redemption fees** are subject to Sperax DAO approval.&#x20;

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FkUI3CXx2uPKtlUI9yZnB%2FFrame%201618872946.png?alt=media&#x26;token=61fa23d8-5a3b-412f-9202-9987d1d73d8d" alt=""><figcaption></figcaption></figure>

### Caps

While minting USDs, if the price of the collateral token is more than 1 USD, then USDs will treat the price of the collateral as 1 USD and will only mint 1 USDs per collateral token deposited. But if the price of the collateral is less than 1 USD then more units of the collateral will be required to mint a unit of USDs. In that case minters would need to provide 1 USD worth of collateral to mint 1 USDs. If the price of the collateral has dropped below 0.97 cents then users would not be able to use that collateral to mint USDs. While redeeming users would always receive one unit of any collateral token of their choice for one unit of USDs.&#x20;

### Fees

Fees will be calculated and configurable based on the current state of the protocol’s collateral composition. Anyone would be able to call a function that updates the fee parameters. When a collateral would exceed the desired collateral composition the fee for that collateral would increase and its redemption fee would decrease. Similarly when the amount of collateral in the protocol is less than the desired amount, the mint fee for that collateral will decrease and the redemption fee would increase. Initially all collaterals except for USDC will be set to have a desired collateral composition of 20% and the base fee will be set to 0.05%. Any collateral having a composition of greater than the desired collateral composition cap will have a mint fee of greater than the base fee. The exact applicable fee on a collateral will vary and can be queried via a view function in the contract. &#x20;

x: Current collateral value in number of tokens&#x20;

Ca:  (Desired collateral composition in % x Total Collateral in the Vault)

Total collateral in vault = Total USDs supply

## ![](https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FbkCmYFg0P105zrneXaDo%2FScreenshot%202024-01-18%20at%2012.45.56%E2%80%AFPM.png?alt=media\&token=2f4ef929-6a59-4e5f-97ea-68897af388b2) ![](https://lh7-us.googleusercontent.com/0Y1wCD2zvMBSPxMnVsQdBc3kfhdwwR_DCgowN9FDEGaUSEK8QFnFmHpvsJd3Sjoyzen_B0IF3-k_o-WMgI-z6mVyE3b14mkSGIa67N3wnHUVbDAIZkJo9DMLTrIVYbbNGE-RhWY2czmrqnzVpFwDSZo)

Base mint and redeem fee (f base): Base fee for mint and redemption which will be discounted/increased dynamically based on the collaterals composition.

### Redeeming from Strategies

Now users can redeem their choice of collateral from any yield strategy, instead of relying on a preset default mechanism. Strategies are a set of smart contracts that control the depositing and withdrawal of collaterals from various other DeFi protocols like Aave, Compound, Fluid etc. The slippage that occurs is still transferred back to the redeemers but since redeemers have a choice, they could calculate and manage their own slippage.

Auto-yield is distributed after a user redeems and before a user mints. So, minters and redeemers should check if there’s an eligible auto-yield.&#x20;

<br>

<br>


# Auto Yield

USDs earns organic yield for holders, and the yield is paid out in USDs using a public rebase function that can be executed using a button every 24 hours if the yield is more than 3%.

USDs stands out, thanks to its inflation fighting auto-yield feature. USDs is novel in the stablecoin ecosystem, because it requires no action by the user. Users do not need to stake USDs nor spend gas to claim their yield. One simply holds USDs, and their wallet balance will grow.

The collateral received for minting USDs is deployed in other audited DeFi projects to generate organic yield. USDs collateral earns yield in the form of reward tokens and swapping fees from the pools. This yield is shared between USDs holders and SPA stakers (The split is 70% for auto-yield and 30% for SPA buyback and burns. This share can be changed through governance).

Gas free yield: 70% of yield generated on USDs collateral is used to mint USDs. This USDs is distributed to anyone who holds USDs in their wallet.

The actual yield generated depends on the yield rate of the strategies where collateral is deployed. The yield cap has been set to 25%. Any yield generated over 25% is stored in the protocol to help fund the APY for lean periods when actual yield generated is less than 25%.

### Yield Strategies

Different yield generation strategies are proposed by the community/team and evaluated by the community based on their yield generation potential, risk profile etc. Community then votes to choose pools/farms where collateral will be deployed. Following strategies are being used for yield generation. We will keep updating this list to include newer strategies approved by the community.

* **USDC:**

  * Compound (USDC)
  * Aave (USDC)
  * Fluid (USDC)

  Maximum cap of 75% of total USDC collateral for each strategy.
* **USDC.e:**

  * Compound (USDC.e)
  * Stargate (Stargate-LP USDC.e)
  * Aave (USDC.e)
  * Curve (FRAX-USDC.E)
  * Fluid (USDC.e)

  Maximum cap of 50% of total USDC.e collateral for each strategy.
* **USDT:**

  * Aave (USDT)
  * Stargate (Stargate-LP USDT)
  * Fluid (USDT)

  Maximum cap of 75% of total USDT collateral for each strategy.

**Old strategies that are not in use / deprecated:**

* **Curve | Curve-LP USDC/USDT** \[Not in use]
* **Saddle | Saddle-LP FRAX/USDC** \[Saddle sunset]
* **Frax | Curve-LP FRAX/VST** \[Vesta sunset]

### Eligibility

USDs held in EOA wallets, i.e. non-contract addresses, will receive auto-yield on a regular basis. For now, USDs that are deployed by users to yield-earning strategies within the Sperax suite of yield farms will not receive auto-yield.

By default, smart contracts can opt for auto-yield via a public Rebase Function.

### Auto-yield distribution mechanism&#x20;

USDs follows the ERC20 token standard. A wallet holding USDs should expect its USDs balance to increase automatically over time. This increase is triggered by a distribution event that can be triggered whenever the yield is greater than 3%. On average, the event gets triggered approximately every 24 hours. The earned USDs are not explicitly transferred into the user’s wallet, instead a global parameter is changed to update the holder's balance.

Unlike most ERC20, where the token contract directly stores the amount of tokens each wallet holds, USDs’ token contract has a shared state variable creditPerToken, and the contract stores each wallet’s credit. A wallet’s balance = credit / creditPerToken.

When yield is generated:

1. The yield is swapped for USDs in the open market
2. The USDs from step (1) is burned
3. The value of `creditPerToken` is \*decreased globally and therefore every wallet’s balance increases (since every wallet’s credit is unchanged during this process)

\*`creditPerToken` is decreased according to the number of USDs burnt in step (2) such that total supply of USDs remains unchanged after steps (2) and (3)

The circulating supply of USDs remains unchanged through this process as the USDs that are bought from the market are burnt and then the USDs balance of the holders increase proportionally. As a result, a user can expect its USDs balance to increase automatically over time without any additional USDs explicitly being transferred to the user’s wallet.

### Yield distribution frequency&#x20;

Yield is distributed approximately every 24 hours. The [admin ](https://www.app.sperax.io/admin)page has a rebase button, which can be triggered at a time gap of 24 hours, whenever the yield is greater than 3%.


# Smart Contracts can opt in for the rebase feature (Auto-yield).

Externally owned accounts (EOAs) holding USDs were always eligible for the Auto-yield feature, but smart contract / smart wallets were not.

Sperax has introduced a new function: now smart accounts (or smart wallets) can call to opt in for auto rebase in USDs contract and to get Auto-yield.

An owners of a smart contract / smart wallet  can opt in for rebase in USDs contract. The users will not need  to claim (or send out any transactions to claim) the interest earned.

This is how to opt in your smart contract / smart wallet for rebase in USDs:

1. Go to Arbiscan and search for USDs. Verify the correct USDs contract address: 0xD74f5255D557944cf7Dd0E45FF521520002D5748<br>
2. Go to the Token contract. ensure it is Sperax USD (USDs) deployed by Sperax Deployer 0x42d2f9f84EeB86574aA4E9FCccfD74066d809600<br>
3. Click on the contract and make sure your account is connected (Metamask, Gnosis Safe, or any other smart account).<br>
4. Go to “Write as Proxy”.<br>
5. Connect your wallet (choose WalletConnect, Coinbase Wallet, or any other wallet).<br>
6. Once connected, you will see two functions with the same name: `rebaseOptIn`\
   \
   You don’t have to call the first function because it’s an owner-only function (can be called only by the USDs owner).\
   \
   Instead, click the second function `rebaseOptIn`. This allows you to opt in for rebase for your own account (your smart contract account).<br>
7. Confirm the transaction, and your smart account will be opted in for auto rebase.

That’s it. Your smart account / smart wallet is eligible for auto-yield!

{% embed url="<https://www.youtube.com/watch?v=rv4ut4QIpMI>" %}


# Stability Mechanism

How does USDs keep the peg?

### 1. Cap/Floor collateral value to $1 while minting/redeeming 1 USDs

**Minting** **1 USDs** - If a collateral token is worth less than $1, it will be treated with its actual market price. However, if it is worth more than 1 dollar, it will be treated as $1.

**Redeeming** **1 USDs** - If a collateral token is worth more than $1, it will be treated with its actual market price. However, if it is worth less than 1 dollar, it will be treated as 1 units of collateral at its market price.

Hence, USDs will always be fully collateralized or over-collateralized. For more information on how mint and redeem functions work check out[minting-and-redeeming](https://docs.sperax.io/master/minting-and-redeeming "mention")

### 2. Redemption Fee

The protocol collects a redemption fee whenever USDs is redeemed. This fee is passed on to the SPA stakers. Redemption fee is levied so that protocol does not work like a free token swap instrument. The fee is static for each collateral token but can be upgraded through governance by the community. It is a percentage of the transaction value.

1. **Mint Fee = 0**
2. **Redemption Fee = x% of the amount of USDs redeemed.**&#x20;

x depends on the selected collateral.  Check the current redemption fee for the USDs in [app.sperax.io](https://app.sperax.io/)

### 3. Pause minting USDs with de-pegged collateral&#x20;

If the collateral being used to mint USDs has de-pegged by 3% or more to the downside, then the protocol will stop minting USDs using that collateral.

### 4. Auto-yield for USDs holders&#x20;

As more people use USDs, the yield rate will serve as a second-layer protection from a high selling pressure, further empowering a mass adoption in various use cases including payment, derivatives, and portfolio construction. For more information on how auto-yield works check out [auto-yield](https://docs.sperax.io/master/auto-yield "mention")

### 5. SPA is given on Redemption when sufficient collateral is not available&#x20;

When sufficient collateral is not available, USDs redeemers would get $1 worth of collateral in the form of SPA tokens from the treasury. This would be the collateral of last resort.


# Key parameters and functions

## Key parameters upgradeable via governance

* Collateral types to mint/ redeem USDs.
* Desired collateral composition, oracle used for price feed of the collateral, base Mint Fee, base Redemption Fee and price floor for each collateral type. Updating the price floor for collateral used to mint USDs. Setting the price floors for each collateral will allow the protocol to remain solvent when collaterals depeg. The protocol will not mint USDs with the collateral when the price of the collateral falls below the price floor.
* Yield generation strategies for each collateral type. For example, adding new delta-neutral yield farming strategies based on other decentralized exchanges.
* Harvesting incentive.
* The USDs dripping rate from the dripper contract.
* Minimum and maximum APR for distribution of Auto-Yield.

### Key functions available to the public

* Harvesting or claiming all kinds of yield tokens from the yield generation strategies. The harvester will be incentivized with a portion of the yield-farmed tokens.
* Purchase harvested yield tokens for market price. We will use the respective oracles for the yield tokens to determine the market price. This experience will be similar to the currently implemented buyback contract.&#x20;
* Distributing the auto-yield to all addresses eligible to collect it. Rebase will also be triggered when someone Mints or Redeems.


# Technical documents

This technical document is about the upgrade to USDs-v2. It details the changes made to enhance the protocol's decentralization, transparency, security, and scalability. The document covers new features and functionalities.

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FpmrX0JEDnYd3CBIeD5Fd%2FTechnical%20documents%20(4).png?alt=media&#x26;token=925fb33e-1091-425e-a676-e4101e86960e" alt=""><figcaption></figcaption></figure>


# Sequence diagrams

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2F7jTojXsMpjAKmczhgVKZ%2FMintFlow.svg?alt=media&#x26;token=c8b97854-ce52-4e20-9420-e0d40d2df9ee" alt=""><figcaption><p>Mint Flow</p></figcaption></figure>

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2Foc6PcoRq01fcEriA68JU%2FRedeemFlow.svg?alt=media&#x26;token=0eae9f23-f292-4b93-b9a2-cafbf3d61e4a" alt=""><figcaption><p>USDs Redeem Flow</p></figcaption></figure>

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FCQuSKe1b8PMAqdj5GVUe%2FYieldGenerationFlow.svg?alt=media&#x26;token=bf638514-9905-4a36-aa76-984308251737" alt=""><figcaption><p>Yield generation</p></figcaption></figure>

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FtqAielnAT5eXtToE3k0S%2FRebaseFlow.svg?alt=media&#x26;token=9c34673b-77e5-4ac9-85cc-ddd9145ad15a" alt=""><figcaption><p>Rebase Flow</p></figcaption></figure>


# Smart contracts

High level documentation of smart contracts


# Vault

## Vault

* Responsible for following actions on USDs:
  * Mint USDs token
  * Redeem USDs token
  * Carry out rebase for USDs token
  * Allocate collateral to strategies
  * Withdraw collateral from strategies

## Contract documentation

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/vault/VaultCore.sol)

**Inherits:** Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable

**Author:** Sperax Foundation

This contract enables users to mint and redeem USDs with allowed collaterals.

It also allocates collateral to strategies based on the Collateral Manager contract.

### **State Variables**

#### **feeVault**

```solidity
address public feeVault;

```

#### **yieldReceiver**

```solidity
address public yieldReceiver;

```

#### **collateralManager**

```solidity
address public collateralManager;

```

#### **feeCalculator**

```solidity
address public feeCalculator;

```

#### **oracle**

```solidity
address public oracle;

```

#### **rebaseManager**

```solidity
address public rebaseManager;

```

### **Functions**

#### **constructor**

```solidity
constructor();

```

#### **initialize**

```solidity
function initialize() external initializer;

```

#### **updateFeeVault**

Updates the address receiving fee.

```solidity
function updateFeeVault(address _feeVault) external onlyOwner;

```

**Parameters**

| Name       | Type    | Description                     |
| ---------- | ------- | ------------------------------- |
| \_feeVault | address | New desired SPABuyback address. |

#### **updateYieldReceiver**

Updates the address receiving yields from strategies.

```solidity
function updateYieldReceiver(address _yieldReceiver) external onlyOwner;

```

**Parameters**

| Name            | Type    | Description                         |
| --------------- | ------- | ----------------------------------- |
| \_yieldReceiver | address | New desired yield receiver address. |

#### **updateCollateralManager**

Updates the address having the configuration for collaterals.

```solidity
function updateCollateralManager(address _collateralManager) external onlyOwner;

```

**Parameters**

| Name                | Type    | Description                             |
| ------------------- | ------- | --------------------------------------- |
| \_collateralManager | address | New desired collateral manager address. |

#### **updateRebaseManager**

Updates the address having the configuration for rebases.

```solidity
function updateRebaseManager(address _rebaseManager) external onlyOwner;

```

**Parameters**

| Name            | Type    | Description                         |
| --------------- | ------- | ----------------------------------- |
| \_rebaseManager | address | New desired rebase manager address. |

#### **updateFeeCalculator**

Updates the fee calculator library.

```solidity
function updateFeeCalculator(address _feeCalculator) external onlyOwner;

```

**Parameters**

| Name            | Type    | Description                         |
| --------------- | ------- | ----------------------------------- |
| \_feeCalculator | address | New desired fee calculator address. |

#### **updateOracle**

Updates the price oracle address.

```solidity
function updateOracle(address _oracle) external onlyOwner;

```

**Parameters**

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| \_oracle | address | New desired oracle address. |

#### **allocate**

Allocates `_amount` of `_collateral` to `_strategy`.

```solidity
function allocate(address _collateral, address _strategy, uint256 _amount) external nonReentrant;

```

**Parameters**

| Name         | Type    | Description                           |
| ------------ | ------- | ------------------------------------- |
| \_collateral | address | Address of the desired collateral.    |
| \_strategy   | address | Address of the desired strategy.      |
| \_amount     | uint256 | Amount of collateral to be allocated. |

#### **mint**

Mint USDs by depositing collateral.

```solidity
function mint(address _collateral, uint256 _collateralAmt, uint256 _minUSDSAmt, uint256 _deadline)
    external
    nonReentrant;

```

**Parameters**

| Name            | Type    | Description                                   |
| --------------- | ------- | --------------------------------------------- |
| \_collateral    | address | Address of the collateral.                    |
| \_collateralAmt | uint256 | Amount of collateral to mint USDs with.       |
| \_minUSDSAmt    | uint256 | Minimum expected amount of USDs to be minted. |
| \_deadline      | uint256 | Expiry time of the transaction.               |

#### **mintBySpecifyingCollateralAmt**

Mint USDs by depositing collateral (backward compatibility).

*This function is for backward compatibility.*

```solidity
function mintBySpecifyingCollateralAmt(
    address _collateral,
    uint256 _collateralAmt,
    uint256 _minUSDSAmt,
    uint256,
    uint256 _deadline
) external nonReentrant;

```

**Parameters**

| Name            | Type    | Description                                   |
| --------------- | ------- | --------------------------------------------- |
| \_collateral    | address | Address of the collateral.                    |
| \_collateralAmt | uint256 | Amount of collateral to mint USDs with.       |
| \_minUSDSAmt    | uint256 | Minimum expected amount of USDs to be minted. |
|                 | uint256 |                                               |
| \_deadline      | uint256 | Expiry time of the transaction.               |

#### **redeem**

Redeem USDs for `_collateral`.

*In case where there is not sufficient collateral available in the vault, the collateral is withdrawn from the default strategy configured for the collateral.*

```solidity
function redeem(address _collateral, uint256 _usdsAmt, uint256 _minCollAmt, uint256 _deadline) external nonReentrant;

```

**Parameters**

| Name         | Type    | Description                                           |
| ------------ | ------- | ----------------------------------------------------- |
| \_collateral | address | Address of the collateral.                            |
| \_usdsAmt    | uint256 | Amount of USDs to be redeemed.                        |
| \_minCollAmt | uint256 | Minimum expected amount of collateral to be received. |
| \_deadline   | uint256 | Expiry time of the transaction.                       |

#### **redeem**

Redeem USDs for `_collateral` from a specific strategy.

```solidity
function redeem(address _collateral, uint256 _usdsAmt, uint256 _minCollAmt, uint256 _deadline, address _strategy)
    external
    nonReentrant;

```

**Parameters**

| Name         | Type    | Description                                                 |
| ------------ | ------- | ----------------------------------------------------------- |
| \_collateral | address | Address of the collateral.                                  |
| \_usdsAmt    | uint256 | Amount of USDs to be redeemed.                              |
| \_minCollAmt | uint256 | Minimum expected amount of collateral to be received.       |
| \_deadline   | uint256 | Expiry time of the transaction.                             |
| \_strategy   | address | Address of the strategy to withdraw excess collateral from. |

#### **redeemView**

Get the expected redeem result.

```solidity
function redeemView(address _collateral, uint256 _usdsAmt)
    external
    view
    returns (
        uint256 calculatedCollateralAmt,
        uint256 usdsBurnAmt,
        uint256 feeAmt,
        uint256 vaultAmt,
        uint256 strategyAmt
    );

```

**Parameters**

| Name         | Type    | Description                    |
| ------------ | ------- | ------------------------------ |
| \_collateral | address | Desired collateral address.    |
| \_usdsAmt    | uint256 | Amount of USDs to be redeemed. |

**Returns**

| Name                    | Type    | Description                                                                  |
| ----------------------- | ------- | ---------------------------------------------------------------------------- |
| calculatedCollateralAmt | uint256 | Expected amount of collateral to be released based on the price calculation. |
| usdsBurnAmt             | uint256 | Expected amount of USDs to be burnt in the process.                          |
| feeAmt                  | uint256 | Amount of USDs collected as fee for redemption.                              |
| vaultAmt                | uint256 | Amount of collateral released from Vault.                                    |
| strategyAmt             | uint256 | Amount of collateral to withdraw from the strategy.                          |

#### **redeemView**

Get the expected redeem result from a specific strategy.

```solidity
function redeemView(address _collateral, uint256 _usdsAmt, address _strategyAddr)
    external
    view
    returns (
        uint256 calculatedCollateralAmt,
        uint256 usdsBurnAmt,
        uint256 feeAmt,
        uint256 vaultAmt,
        uint256 strategyAmt
    );

```

**Parameters**

| Name           | Type    | Description                         |
| -------------- | ------- | ----------------------------------- |
| \_collateral   | address | Desired collateral address.         |
| \_usdsAmt      | uint256 | Amount of USDs to be redeemed.      |
| \_strategyAddr | address | Address of strategy to redeem from. |

**Returns**

| Name                    | Type    | Description                                                                  |
| ----------------------- | ------- | ---------------------------------------------------------------------------- |
| calculatedCollateralAmt | uint256 | Expected amount of collateral to be released based on the price calculation. |
| usdsBurnAmt             | uint256 | Expected amount of USDs to be burnt in the process.                          |
| feeAmt                  | uint256 | Amount of USDs collected as fee for redemption.                              |
| vaultAmt                | uint256 | Amount of collateral released from Vault.                                    |
| strategyAmt             | uint256 | Amount of collateral to withdraw from the strategy.                          |

#### **rebase**

Rebase USDs to share earned yield with the USDs holders.

*If Rebase manager returns a non-zero value, it calls the rebase function on the USDs contract.*

```solidity
function rebase() public;

```

#### **mintView**

Get the expected mint result (USDs amount, fee).

```solidity
function mintView(address _collateral, uint256 _collateralAmt) public view returns (uint256, uint256);

```

**Parameters**

| Name            | Type    | Description            |
| --------------- | ------- | ---------------------- |
| \_collateral    | address | Address of collateral. |
| \_collateralAmt | uint256 | Amount of collateral.  |

**Returns**

| Name | Type    | Description                                                |
| ---- | ------- | ---------------------------------------------------------- |
|      | uint256 | Returns the expected USDs mint amount and fee for minting. |
|      | uint256 |                                                            |

#### **\_mint**

Mint USDs by depositing collateral.

*Mints USDs by locking collateral based on user input, ensuring a minimum expected minted amount is met.*

*If the minimum expected amount is not met, the transaction will revert.*

*Fee is collected, and collateral is transferred accordingly.*

*A rebase operation is triggered after minting.*

```solidity
function _mint(address _collateral, uint256 _collateralAmt, uint256 _minUSDSAmt, uint256 _deadline) private;

```

**Parameters**

| Name            | Type    | Description                                   |
| --------------- | ------- | --------------------------------------------- |
| \_collateral    | address | Address of the collateral.                    |
| \_collateralAmt | uint256 | Amount of collateral to deposit.              |
| \_minUSDSAmt    | uint256 | Minimum expected amount of USDs to be minted. |
| \_deadline      | uint256 | Deadline timestamp for executing mint.        |

#### **\_redeem**

Redeem USDs for collateral.

*Redeems USDs for collateral, ensuring a minimum expected collateral amount is met.*

*If the minimum expected collateral amount is not met, the transaction will revert.*

*Fee is collected, collateral is transferred, and a rebase operation is triggered.*

```solidity
function _redeem(
    address _collateral,
    uint256 _usdsAmt,
    uint256 _minCollateralAmt,
    uint256 _deadline,
    address _strategyAddr
) private;

```

**Parameters**

| Name               | Type    | Description                                        |
| ------------------ | ------- | -------------------------------------------------- |
| \_collateral       | address | Address of the collateral to receive.              |
| \_usdsAmt          | uint256 | Amount of USDs to redeem.                          |
| \_minCollateralAmt | uint256 | Minimum expected collateral amount to be received. |
| \_deadline         | uint256 | Deadline timestamp for executing the redemption.   |
| \_strategyAddr     | address | Address of the strategy to withdraw from.          |

#### **\_redeemView**

Get the expected redeem result.

*Calculates the expected results of a redemption, including collateral amount, fees, and strategy-specific details.*

*Ensures that the redemption is allowed for the specified collateral.*

*Calculates fees, burn amounts, and collateral amounts based on prices and conversion factors.*

*Determines if collateral needs to be withdrawn from a strategy, and if so, checks the availability of collateral in the strategy.*

```solidity
function _redeemView(address _collateral, uint256 _usdsAmt, address _strategyAddr)
    private
    view
    returns (
        uint256 calculatedCollateralAmt,
        uint256 usdsBurnAmt,
        uint256 feeAmt,
        uint256 vaultAmt,
        uint256 strategyAmt,
        IStrategy strategy
    );

```

**Parameters**

| Name           | Type    | Description                             |
| -------------- | ------- | --------------------------------------- |
| \_collateral   | address | Desired collateral address.             |
| \_usdsAmt      | uint256 | Amount of USDs to be redeemed.          |
| \_strategyAddr | address | Address of the strategy to redeem from. |

**Returns**

| Name                    | Type      | Description                                                                  |
| ----------------------- | --------- | ---------------------------------------------------------------------------- |
| calculatedCollateralAmt | uint256   | Expected amount of collateral to be released based on the price calculation. |
| usdsBurnAmt             | uint256   | Expected amount of USDs to be burnt in the process.                          |
| feeAmt                  | uint256   | Amount of USDs collected as a fee for redemption.                            |
| vaultAmt                | uint256   | Amount of collateral released from Vault.                                    |
| strategyAmt             | uint256   | Amount of collateral to withdraw from the strategy.                          |
| strategy                | IStrategy | Strategy contract to withdraw collateral from.                               |

### **Events**

#### **FeeVaultUpdated**

```solidity
event FeeVaultUpdated(address newFeeVault);

```

#### **YieldReceiverUpdated**

```solidity
event YieldReceiverUpdated(address newYieldReceiver);

```

#### **CollateralManagerUpdated**

```solidity
event CollateralManagerUpdated(address newCollateralManager);

```

#### **FeeCalculatorUpdated**

```solidity
event FeeCalculatorUpdated(address newFeeCalculator);

```

#### **RebaseManagerUpdated**

```solidity
event RebaseManagerUpdated(address newRebaseManager);

```

#### **OracleUpdated**

```solidity
event OracleUpdated(address newOracle);

```

#### **Minted**

```solidity
event Minted(
    address indexed wallet, address indexed collateralAddr, uint256 usdsAmt, uint256 collateralAmt, uint256 feeAmt
);

```

#### **Redeemed**

```solidity
event Redeemed(
    address indexed wallet, address indexed collateralAddr, uint256 usdsAmt, uint256 collateralAmt, uint256 feeAmt
);

```

#### **RebasedUSDs**

```solidity
event RebasedUSDs(uint256 rebaseAmt);

```

#### **Allocated**

```solidity
event Allocated(address indexed collateral, address indexed strategy, uint256 amount);

```

### **Errors**

#### **AllocationNotAllowed**

```solidity
error AllocationNotAllowed(address collateral, address strategy, uint256 amount);

```

#### **RedemptionPausedForCollateral**

```solidity
error RedemptionPausedForCollateral(address collateral);

```

#### **InsufficientCollateral**

```solidity
error InsufficientCollateral(address collateral, address strategy, uint256 amount, uint256 availableAmount);

```

#### **InvalidStrategy**

```solidity
error InvalidStrategy(address _collateral, address _strategyAddr);

```

#### **MintFailed**

```solidity
error MintFailed();
```


# USDs

## USDs

* ERC20 contract
* USDs is a stablecoin yield aggregator that provides auto-yield natively.
* USDs is a rebasing token with two modes of accounting for users:
  * **Rebasing wallets**

    * Users holding tokens in their EOA are by default in this category and are eligible for auto-yield via a rebasing mechanism.
    * Any contract opted-in for rebase also comes in this category.
    * Balance for this category is tracked via a credit system, as described below :

    $$
    creditsPerToken = C\_t \ creditBalance = C\_b \ userBalance = C\_b/C\_t
    $$

    * creditsPerToken is tracked at a global level and is updated when doing a rebase.
    * creditBalance is tracked at an account level and is updated via token transfer, mint, redemption of USDs
  * **Non-Rebasing wallets**
    * For Non-Rebasing wallets this token acts as a normal ERC20 token and tracks the balance of the wallet as usual.
* **Rebasing Mechanism**
  * Users mint USDs using approved list of collaterals
  * These collaterals accumulated in the USDs vault are then deployed to various yield on-chain earning opportunities.
  * Yield is harvested periodically and is used to buyback USDs from the market of which 70% goes for USDs auto yield, and rest is used for SPA buyback and burn.
  * While doing a rebase the x amount of USDs is partially burnt (without changing the overall total supply) and the `creditsPerToken` value is adjusted such that the burnt amount is proportionally distributed across all rebasing wallets.

## Contract Documentation

**Inherits:** ERC20PermitUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, [IUSDs](https://file+.vscode-resource.vscode-cdn.net/contracts/interfaces/IUSDs.sol/interface.IUSDs.md)

**Author:** Sperax Foundation

*ERC20 compatible contract for USDs supporting the rebase feature. This ERC20 token represents USDs on the Arbitrum (L2) network. Note that the invariant holds that the sum of balanceOf(x) for all x is not greater than totalSupply(). This is a consequence of the rebasing design. Integrations with USDs should be aware of this feature.*&#x20;

*Inspired by OUSD:* [*https://github.com/OriginProtocol/origindollar/blob/master/contracts/contracts/token/OUSD.sol*](https://github.com/OriginProtocol/origin-dollar/blob/master/contracts/contracts/token/OUSD.sol)

### **State Variables**

#### **MAX\_SUPPLY**

```solidity
uint256 private constant MAX_SUPPLY = ~uint128(0);

```

#### **\_totalSupply**

```solidity
uint256 internal _totalSupply;

```

#### **\_deprecated\_vars**

```solidity
uint256[4] private _deprecated_vars;

```

#### **\_allowances**

```solidity
mapping(address => mapping(address => uint256)) private _allowances;

```

#### **vault**

```solidity
address public vault;

```

#### **\_creditBalances**

```solidity
mapping(address => uint256) private _creditBalances;

```

#### **\_deprecated\_rebasingCredits**

```solidity
uint256 private _deprecated_rebasingCredits;

```

#### **rebasingCreditsPerToken**

```solidity
uint256 public rebasingCreditsPerToken;

```

#### **nonRebasingSupply**

```solidity
uint256 public nonRebasingSupply;

```

#### **nonRebasingCreditsPerToken**

```solidity
mapping(address => uint256) public nonRebasingCreditsPerToken;

```

#### **rebaseState**

```solidity
mapping(address => RebaseOptions) public rebaseState;

```

#### **\_deprecated\_gatewayAddr**

```solidity
address[2] private _deprecated_gatewayAddr;

```

#### **\_deprecated\_isUpgraded**

```solidity
mapping(address => bool) private _deprecated_isUpgraded;

```

#### **paused**

```solidity
bool public paused;

```

### **Functions**

#### **onlyVault**

Verifies that the caller is the Savings Manager contract.

```solidity
modifier onlyVault();

```

#### **constructor**

```solidity
constructor();

```

#### **initialize**

Initializes the contract with the provided name, symbol, and vault address.

```solidity
function initialize(string memory _nameArg, string memory _symbolArg, address _vaultAddress) external initializer;

```

**Parameters**

| Name           | Type    | Description                                                                                               |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| \_nameArg      | string  | The name of the USDs token.                                                                               |
| \_symbolArg    | string  | The symbol of the USDs token.                                                                             |
| \_vaultAddress | address | The address where collaterals of USDs protocol reside, and major actions like USDs minting are initiated. |

#### **mint**

Mints new USDs tokens, increasing totalSupply.

```solidity
function mint(address _account, uint256 _amount) external override onlyVault nonReentrant;

```

**Parameters**

| Name      | Type    | Description                                                            |
| --------- | ------- | ---------------------------------------------------------------------- |
| \_account | address | The account address to which the newly minted USDs will be attributed. |
| \_amount  | uint256 | The amount of USDs to be minted.                                       |

#### **burn**

Burns tokens, decreasing totalSupply.

```solidity
function burn(uint256 _amount) external override nonReentrant;

```

**Parameters**

| Name     | Type    | Description         |
| -------- | ------- | ------------------- |
| \_amount | uint256 | The amount to burn. |

#### **rebaseOptIn**

Voluntary opt-in for rebase.

*Useful for smart-contract wallets.*

```solidity
function rebaseOptIn() external;

```

#### **rebaseOptOut**

Voluntary opt-out from rebase.

```solidity
function rebaseOptOut() external;

```

#### **rebaseOptIn**

Adds `_account` to the rebasing account list.

```solidity
function rebaseOptIn(address _account) external onlyOwner;

```

**Parameters**

| Name      | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| \_account | address | Address of the desired account. |

#### **rebaseOptOut**

Adds `_account` to the non-rebasing account list.

```solidity
function rebaseOptOut(address _account) external onlyOwner;

```

**Parameters**

| Name      | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| \_account | address | Address of the desired account. |

#### **rebase**

The rebase function. Modifies the supply without minting new tokens. This uses a change in the exchange rate between "credits" and USDs tokens to change balances.

```solidity
function rebase(uint256 _rebaseAmt) external override onlyVault nonReentrant;

```

**Parameters**

| Name        | Type    | Description                        |
| ----------- | ------- | ---------------------------------- |
| \_rebaseAmt | uint256 | The amount of USDs to rebase with. |

#### **updateVault**

Change the vault address.

```solidity
function updateVault(address _newVault) external onlyOwner;

```

**Parameters**

| Name       | Type    | Description            |
| ---------- | ------- | ---------------------- |
| \_newVault | address | The new vault address. |

#### **pauseSwitch**

Called by the owner to pause or unpause the contract.

```solidity
function pauseSwitch(bool _pause) external onlyOwner;

```

**Parameters**

| Name    | Type | Description                    |
| ------- | ---- | ------------------------------ |
| \_pause | bool | The state of the pause switch. |

#### **transfer**

Transfer tokens to a specified address.

```solidity
function transfer(address _to, uint256 _value) public override returns (bool);

```

**Parameters**

| Name    | Type    | Description                   |
| ------- | ------- | ----------------------------- |
| \_to    | address | The address to transfer to.   |
| \_value | uint256 | The amount to be transferred. |

**Returns**

| Name | Type | Description      |
| ---- | ---- | ---------------- |
|      | bool | True on success. |

#### **transferFrom**

Transfer tokens from one address to another.

```solidity
function transferFrom(address _from, address _to, uint256 _value) public override returns (bool);

```

**Parameters**

| Name    | Type    | Description                                          |
| ------- | ------- | ---------------------------------------------------- |
| \_from  | address | The address from which you want to send tokens.      |
| \_to    | address | The address to which the tokens will be transferred. |
| \_value | uint256 | The amount of tokens to be transferred.              |

**Returns**

| Name | Type | Description      |
| ---- | ---- | ---------------- |
|      | bool | true on success. |

#### **approve**

Approve the passed address to spend the specified amount of tokens on behalf of msg.sender. This method is included for ERC20 compatibility.

*increaseAllowance and decreaseAllowance should be used instead. Changing an allowance with this method brings the risk that someone may transfer both the old and the new allowance - if they are both greater than zero - if a transfer transaction is mined before the later approve() call is mined.*

```solidity
function approve(address _spender, uint256 _value) public override returns (bool);

```

**Parameters**

| Name      | Type    | Description                            |
| --------- | ------- | -------------------------------------- |
| \_spender | address | The address that will spend the funds. |
| \_value   | uint256 | The amount of tokens to be spent.      |

**Returns**

| Name | Type | Description      |
| ---- | ---- | ---------------- |
|      | bool | true on success. |

#### **increaseAllowance**

Increase the amount of tokens that an owner has allowed a `_spender` to spend. This method should be used instead of approve() to avoid the double approval vulnerability described above.

```solidity
function increaseAllowance(address _spender, uint256 _addedValue) public override returns (bool);

```

**Parameters**

| Name         | Type    | Description                                        |
| ------------ | ------- | -------------------------------------------------- |
| \_spender    | address | The address that will spend the funds.             |
| \_addedValue | uint256 | The amount of tokens to increase the allowance by. |

**Returns**

| Name | Type | Description      |
| ---- | ---- | ---------------- |
|      | bool | true on success. |

#### **decreaseAllowance**

Decrease the amount of tokens that an owner has allowed a `_spender` to spend.

```solidity
function decreaseAllowance(address _spender, uint256 _subtractedValue) public override returns (bool);

```

**Parameters**

| Name              | Type    | Description                                        |
| ----------------- | ------- | -------------------------------------------------- |
| \_spender         | address | The address that will spend the funds.             |
| \_subtractedValue | uint256 | The amount of tokens to decrease the allowance by. |

**Returns**

| Name | Type | Description      |
| ---- | ---- | ---------------- |
|      | bool | true on success. |

#### **totalSupply**

Check the current total supply of USDs.

```solidity
function totalSupply() public view override(ERC20Upgradeable, IUSDs) returns (uint256);

```

**Returns**

| Name | Type    | Description               |
| ---- | ------- | ------------------------- |
|      | uint256 | The total supply of USDs. |

#### **balanceOf**

Gets the USDs balance of the specified address.

```solidity
function balanceOf(address _account) public view override returns (uint256);

```

**Parameters**

| Name      | Type    | Description                          |
| --------- | ------- | ------------------------------------ |
| \_account | address | The address to query the balance of. |

**Returns**

| Name | Type    | Description                                                                     |
| ---- | ------- | ------------------------------------------------------------------------------- |
|      | uint256 | A uint256 representing the amount of base units owned by the specified address. |

#### **creditsBalanceOf**

Gets the credits balance of the specified address.

```solidity
function creditsBalanceOf(address _account) public view returns (uint256, uint256);

```

**Parameters**

| Name      | Type    | Description                          |
| --------- | ------- | ------------------------------------ |
| \_account | address | The address to query the balance of. |

**Returns**

| Name | Type    | Description                                                             |
| ---- | ------- | ----------------------------------------------------------------------- |
|      | uint256 | (uint256, uint256) Credit balance and credits per token of the address. |
|      | uint256 |                                                                         |

#### **allowance**

Function to check the amount of tokens that an owner has allowed a spender.

```solidity
function allowance(address _owner, address _spender) public view override returns (uint256);

```

**Parameters**

| Name      | Type    | Description                            |
| --------- | ------- | -------------------------------------- |
| \_owner   | address | The address that owns the funds.       |
| \_spender | address | The address that will spend the funds. |

**Returns**

| Name | Type    | Description                                           |
| ---- | ------- | ----------------------------------------------------- |
|      | uint256 | The number of tokens still available for the spender. |

#### **\_mint**

Creates `_amount` tokens and assigns them to `_account`, increasing the total supply.

*Emits a {Transfer} event with `from` set to the zero address.*

*Requirements - `to` cannot be the zero address.*

```solidity
function _mint(address _account, uint256 _amount) internal override;

```

**Parameters**

| Name      | Type    | Description                                                            |
| --------- | ------- | ---------------------------------------------------------------------- |
| \_account | address | The account address to which the newly minted USDs will be attributed. |
| \_amount  | uint256 | The amount of USDs that will be minted.                                |

#### **\_burn**

Destroys `_amount` tokens from `_account`, reducing the total supply.

*Emits a {Transfer} event with `to` set to the zero address.*

* Requirements:
* `_account` cannot be the zero address.
* `_account` must have at least `_amount` tokens.\*

```solidity
function _burn(address _account, uint256 _amount) internal override;

```

**Parameters**

| Name      | Type    | Description                                            |
| --------- | ------- | ------------------------------------------------------ |
| \_account | address | The account address from which the USDs will be burnt. |
| \_amount  | uint256 | The amount of USDs that will be burnt.                 |

#### **\_executeTransfer**

For non-rebasing accounts credit amount = \_amount

Update the count of non-rebasing credits in response to a transfer

```solidity
function _executeTransfer(address _from, address _to, uint256 _value) private;

```

**Parameters**

| Name    | Type    | Description                                          |
| ------- | ------- | ---------------------------------------------------- |
| \_from  | address | The address from which you want to send tokens.      |
| \_to    | address | The address to which the tokens will be transferred. |
| \_value | uint256 | Amount of USDs to transfer                           |

#### **\_rebaseOptIn**

Add a contract address to the non-rebasing exception list. I.e., the address's balance will be part of rebases so the account will be exposed to upside and downside.

```solidity
function _rebaseOptIn(address _account) private;

```

**Parameters**

| Name      | Type    | Description                                  |
| --------- | ------- | -------------------------------------------- |
| \_account | address | address of the account opting in for rebase. |

#### **\_rebaseOptOut**

Remove a contract address from the non-rebasing exception list.

```solidity
function _rebaseOptOut(address _account) private;

```

#### **\_isNonRebasingAccount**

Is an account using rebasing accounting or non-rebasing accounting? Also, ensure contracts are non-rebasing if they have not opted in.

```solidity
function _isNonRebasingAccount(address _account) private returns (bool);

```

**Parameters**

| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| \_account | address | Address of the account. |

#### **\_ensureNonRebasingMigration**

Ensures internal account for rebasing and non-rebasing credits and supply is updated following the deployment of frozen yield change.

```solidity
function _ensureNonRebasingMigration(address _account) private;

```

**Parameters**

| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| \_account | address | Address of the account. |

#### **\_balanceOf**

Calculates the balance of the account.

*Function assumes the \_account is already upgraded.*

```solidity
function _balanceOf(address _account) private view returns (uint256);

```

**Parameters**

| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| \_account | address | Address of the account. |

#### **\_creditsPerToken**

Get the credits per token for an account. Returns a fixed amount if the account is non-rebasing.

```solidity
function _creditsPerToken(address _account) private view returns (uint256);

```

**Parameters**

| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| \_account | address | Address of the account. |

#### **\_isNotPaused**

Validates if the contract is not paused.

```solidity
function _isNotPaused() private view;

```

### **Events**

#### **TotalSupplyUpdated**

```solidity
event TotalSupplyUpdated(uint256 totalSupply, uint256 rebasingCredits, uint256 rebasingCreditsPerToken);

```

#### **Paused**

```solidity
event Paused(bool isPaused);

```

#### **VaultUpdated**

```solidity
event VaultUpdated(address newVault);

```

#### **RebaseOptIn**

```solidity
event RebaseOptIn(address indexed account);

```

#### **RebaseOptOut**

```solidity
event RebaseOptOut(address indexed account);

```

### **Errors**

#### **CallerNotVault**

```solidity
error CallerNotVault(address caller);

```

#### **ContractPaused**

```solidity
error ContractPaused();

```

#### **IsAlreadyRebasingAccount**

```solidity
error IsAlreadyRebasingAccount(address account);

```

#### **IsAlreadyNonRebasingAccount**

```solidity
error IsAlreadyNonRebasingAccount(address account);

```

#### **CannotIncreaseZeroSupply**

```solidity
error CannotIncreaseZeroSupply();

```

#### **InvalidRebase**

```solidity
error InvalidRebase();

```

#### **TransferToZeroAddr**

```solidity
error TransferToZeroAddr();

```

#### **TransferGreaterThanBal**

```solidity
error TransferGreaterThanBal(uint256 val, uint256 bal);

```

#### **MintToZeroAddr**

```solidity
error MintToZeroAddr();

```

#### **MaxSupplyReached**

```solidity
error MaxSupplyReached(uint256 totalSupply);

```

### **Enums**

#### **RebaseOptions**

```solidity
enum RebaseOptions {
    NotSet,
    OptOut,
    OptIn
}
```


# CollateralManager

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/vault/CollateralManager.sol)

**Inherits:** ICollateralManager, Ownable

**Author:** Sperax Foundation

This contract manages the addition and removal of collateral, configuration of collateral strategies, and allocation percentages.

*Collateral Manager interacts with the Vault and various strategies for collateral management.*

## **State Variables**

### **collateralCompositionUsed**

```solidity
uint16 public collateralCompositionUsed;

```

### **VAULT**

```solidity
address public immutable VAULT;

```

### **collaterals**

```solidity
address[] private collaterals;

```

### **collateralInfo**

```solidity
mapping(address => CollateralData) public collateralInfo;

```

### **collateralStrategyInfo**

```solidity
mapping(address => mapping(address => StrategyData)) private collateralStrategyInfo;

```

### **collateralStrategies**

```solidity
mapping(address => address[]) private collateralStrategies;

```

## **Functions**

### **constructor**

*Constructor to initialize the Collateral Manager*

```solidity
constructor(address _vault);

```

**Parameters**

| Name    | Type    | Description                   |
| ------- | ------- | ----------------------------- |
| \_vault | address | Address of the Vault contract |

### **addCollateral**

Register a collateral for mint & redeem in USDs

```solidity
function addCollateral(address _collateral, CollateralBaseData memory _data) external onlyOwner;

```

**Parameters**

| Name         | Type               | Description                   |
| ------------ | ------------------ | ----------------------------- |
| \_collateral | address            | Address of the collateral     |
| \_data       | CollateralBaseData | Collateral configuration data |

### **updateCollateralData**

Update existing collateral configuration

```solidity
function updateCollateralData(address _collateral, CollateralBaseData memory _updateData) external onlyOwner;

```

**Parameters**

| Name         | Type               | Description                              |
| ------------ | ------------------ | ---------------------------------------- |
| \_collateral | address            | Address of the collateral                |
| \_updateData | CollateralBaseData | Updated configuration for the collateral |

### **removeCollateral**

Un-list a collateral

```solidity
function removeCollateral(address _collateral) external onlyOwner;

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

### **addCollateralStrategy**

Add a new strategy to collateral

```solidity
function addCollateralStrategy(address _collateral, address _strategy, uint16 _allocationCap) external onlyOwner;

```

**Parameters**

| Name            | Type    | Description               |
| --------------- | ------- | ------------------------- |
| \_collateral    | address | Address of the collateral |
| \_strategy      | address | Address of the strategy   |
| \_allocationCap | uint16  | Allocation capacity       |

### **updateCollateralStrategy**

Update existing strategy for collateral

```solidity
function updateCollateralStrategy(address _collateral, address _strategy, uint16 _allocationCap) external onlyOwner;

```

**Parameters**

| Name            | Type    | Description               |
| --------------- | ------- | ------------------------- |
| \_collateral    | address | Address of the collateral |
| \_strategy      | address | Address of the strategy   |
| \_allocationCap | uint16  | Allocation capacity       |

### **removeCollateralStrategy**

Remove an existing strategy from collateral

*Ensure all the collateral is removed from the strategy before calling this Otherwise it will create error in collateral accounting*

```solidity
function removeCollateralStrategy(address _collateral, address _strategy) external onlyOwner;

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |
| \_strategy   | address | Address of the strategy   |

### **updateCollateralDefaultStrategy**

```solidity
function updateCollateralDefaultStrategy(address _collateral, address _strategy) external onlyOwner;

```

### **validateAllocation**

Validate allocation for a collateral

```solidity
function validateAllocation(address _collateral, address _strategy, uint256 _amount) external view returns (bool);

```

**Parameters**

| Name         | Type    | Description                     |
| ------------ | ------- | ------------------------------- |
| \_collateral | address | Address of the collateral       |
| \_strategy   | address | Address of the desired strategy |
| \_amount     | uint256 | Amount to be allocated.         |

**Returns**

| Name | Type | Description                        |
| ---- | ---- | ---------------------------------- |
|      | bool | True for valid allocation request. |

### **getFeeCalibrationData**

Get the required data for mint

```solidity
function getFeeCalibrationData(address _collateral) external view returns (uint16, uint16, uint16, uint256);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

**Returns**

| Name | Type    | Description                                                                               |
| ---- | ------- | ----------------------------------------------------------------------------------------- |
|      | uint16  | Base fee config for collateral (baseMintFee, baseRedeemFee, composition, totalCollateral) |
|      | uint16  |                                                                                           |
|      | uint16  |                                                                                           |
|      | uint256 |                                                                                           |

### **getMintParams**

Get the required data for mint

```solidity
function getMintParams(address _collateral) external view returns (CollateralMintData memory mintData);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

**Returns**

| Name     | Type               | Description |
| -------- | ------------------ | ----------- |
| mintData | CollateralMintData | mintData    |

### **getRedeemParams**

Get the required data for USDs redemption

```solidity
function getRedeemParams(address _collateral) external view returns (CollateralRedeemData memory redeemData);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

**Returns**

| Name       | Type                 | Description |
| ---------- | -------------------- | ----------- |
| redeemData | CollateralRedeemData | redeemData  |

### **getAllCollaterals**

Gets a list of all listed collaterals

```solidity
function getAllCollaterals() external view returns (address[] memory);

```

**Returns**

| Name | Type       | Description                                           |
| ---- | ---------- | ----------------------------------------------------- |
|      | address\[] | List of addresses representing all listed collaterals |

### **getCollateralStrategies**

Gets a list of all strategies linked to a collateral

```solidity
function getCollateralStrategies(address _collateral) external view returns (address[] memory);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

**Returns**

| Name | Type       | Description                                                            |
| ---- | ---------- | ---------------------------------------------------------------------- |
|      | address\[] | List of addresses representing available strategies for the collateral |

### **isValidStrategy**

Verifies if a strategy is linked to a collateral

```solidity
function isValidStrategy(address _collateral, address _strategy) external view returns (bool);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |
| \_strategy   | address | Address of the strategy   |

**Returns**

| Name | Type | Description                                                       |
| ---- | ---- | ----------------------------------------------------------------- |
|      | bool | True if the strategy is linked to the collateral, otherwise False |

### **getCollateralInStrategies**

Get the amount of collateral in all Strategies

```solidity
function getCollateralInStrategies(address _collateral) public view returns (uint256 amountInStrategies);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

**Returns**

| Name               | Type    | Description        |
| ------------------ | ------- | ------------------ |
| amountInStrategies | uint256 | amountInStrategies |

### **getCollateralInVault**

Get the amount of collateral in vault

```solidity
function getCollateralInVault(address _collateral) public view returns (uint256 amountInVault);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |

**Returns**

| Name          | Type    | Description   |
| ------------- | ------- | ------------- |
| amountInVault | uint256 | amountInVault |

### **getCollateralInAStrategy**

Get the amount of collateral allocated in a strategy

```solidity
function getCollateralInAStrategy(address _collateral, address _strategy) public view returns (uint256 allocatedAmt);

```

**Parameters**

| Name         | Type    | Description               |
| ------------ | ------- | ------------------------- |
| \_collateral | address | Address of the collateral |
| \_strategy   | address | Address of the strategy   |

**Returns**

| Name         | Type    | Description      |
| ------------ | ------- | ---------------- |
| allocatedAmt | uint256 | Allocated amount |

## **Events**

### **CollateralAdded**

```solidity
event CollateralAdded(address collateral, CollateralBaseData data);

```

### **CollateralRemoved**

```solidity
event CollateralRemoved(address collateral);

```

### **CollateralInfoUpdated**

```solidity
event CollateralInfoUpdated(address collateral, CollateralBaseData data);

```

### **CollateralStrategyAdded**

```solidity
event CollateralStrategyAdded(address collateral, address strategy);

```

### **CollateralStrategyUpdated**

```solidity
event CollateralStrategyUpdated(address collateral, address strategy);

```

### **CollateralStrategyRemoved**

```solidity
event CollateralStrategyRemoved(address collateral, address strategy);

```

## **Errors**

### **CollateralExists**

```solidity
error CollateralExists();

```

### **CollateralDoesNotExist**

```solidity
error CollateralDoesNotExist();

```

### **CollateralStrategyExists**

```solidity
error CollateralStrategyExists();

```

### **CollateralStrategyMapped**

```solidity
error CollateralStrategyMapped();

```

### **CollateralStrategyNotMapped**

```solidity
error CollateralStrategyNotMapped();

```

### **CollateralNotSupportedByStrategy**

```solidity
error CollateralNotSupportedByStrategy();

```

### **CollateralAllocationPaused**

```solidity
error CollateralAllocationPaused();

```

### **CollateralStrategyInUse**

```solidity
error CollateralStrategyInUse();

```

### **AllocationPercentageLowerThanAllocatedAmt**

```solidity
error AllocationPercentageLowerThanAllocatedAmt();

```

### **IsDefaultStrategy**

```solidity
error IsDefaultStrategy();

```

## **Structs**

### **CollateralData**

```solidity
struct CollateralData {
    bool mintAllowed;
    bool redeemAllowed;
    bool allocationAllowed;
    bool exists;
    address defaultStrategy;
    uint16 baseMintFee;
    uint16 baseRedeemFee;
    uint16 downsidePeg;
    uint16 desiredCollateralComposition;
    uint16 collateralCapacityUsed;
    uint256 conversionFactor;
}

```

### **StrategyData**

```solidity
struct StrategyData {
    uint16 allocationCap;
    bool exists;
}
```


# SPA Buyback

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/buyback/SPABuyback.sol)

**Inherits:** Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable

**Author:** Sperax Foundation

This contract allows users to exchange SPA tokens for USDs tokens.

*Users can provide SPA tokens and receive USDs tokens in return based on the current exchange rate.*

*A percentage of the provided SPA tokens are distributed as rewards, and the rest are burned.*

## **State Variables**

### **veSpaRewarder**

```solidity
address public veSpaRewarder;

```

### **rewardPercentage**

```solidity
uint256 public rewardPercentage;

```

### **oracle**

```solidity
address public oracle;

```

## **Functions**

### **constructor**

```solidity
constructor();

```

### **initialize**

*Contract initializer*

```solidity
function initialize(address _veSpaRewarder, uint256 _rewardPercentage) external initializer;

```

**Parameters**

| Name               | Type    | Description                      |
| ------------------ | ------- | -------------------------------- |
| \_veSpaRewarder    | address | Rewarder's address               |
| \_rewardPercentage | uint256 | Percentage of SPA to be rewarded |

### **withdraw**

Emergency withdrawal function for unexpected situations

*Can only be called by the owner*

```solidity
function withdraw(address _token, address _receiver, uint256 _amount) external onlyOwner;

```

**Parameters**

| Name       | Type    | Description                          |
| ---------- | ------- | ------------------------------------ |
| \_token    | address | Address of the asset to be withdrawn |
| \_receiver | address | Address of the receiver of tokens    |
| \_amount   | uint256 | Amount of tokens to be withdrawn     |

### **updateRewardPercentage**

Changes the reward percentage

*Example value for \_newRewardPercentage = 5000 for 50%*

```solidity
function updateRewardPercentage(uint256 _newRewardPercentage) external onlyOwner;

```

**Parameters**

| Name                  | Type    | Description           |
| --------------------- | ------- | --------------------- |
| \_newRewardPercentage | uint256 | New Reward Percentage |

### **updateVeSpaRewarder**

Update veSpaRewarder address

```solidity
function updateVeSpaRewarder(address _newVeSpaRewarder) external onlyOwner;

```

**Parameters**

| Name               | Type    | Description                             |
| ------------------ | ------- | --------------------------------------- |
| \_newVeSpaRewarder | address | is the address of desired veSpaRewarder |

### **updateOracle**

Update oracle address

```solidity
function updateOracle(address _newOracle) external onlyOwner;

```

**Parameters**

| Name        | Type    | Description                      |
| ----------- | ------- | -------------------------------- |
| \_newOracle | address | is the address of desired oracle |

### **buyUSDs**

Function to buy USDs for SPA for frontend

```solidity
function buyUSDs(uint256 _spaIn, uint256 _minUSDsOut) external;

```

**Parameters**

| Name         | Type    | Description                |
| ------------ | ------- | -------------------------- |
| \_spaIn      | uint256 | Amount of SPA tokens       |
| \_minUSDsOut | uint256 | Minimum amount out in USDs |

### **getSPAReqdForUSDs**

Calculates and returns SPA amount required for \_usdsAmount

```solidity
function getSPAReqdForUSDs(uint256 _usdsAmount) external view returns (uint256);

```

**Parameters**

| Name         | Type    | Description                |
| ------------ | ------- | -------------------------- |
| \_usdsAmount | uint256 | USDs amount the user wants |

**Returns**

| Name | Type    | Description            |
| ---- | ------- | ---------------------- |
|      | uint256 | Amount of SPA required |

### **buyUSDs**

Buy USDs for SPA if you want a different receiver

```solidity
function buyUSDs(address _receiver, uint256 _spaIn, uint256 _minUSDsOut) public nonReentrant;

```

**Parameters**

| Name         | Type    | Description                |
| ------------ | ------- | -------------------------- |
| \_receiver   | address | Receiver of USDs           |
| \_spaIn      | uint256 | Amount of SPA tokens       |
| \_minUSDsOut | uint256 | Minimum amount out in USDs |

### **distributeAndBurnSPA**

Sends available SPA in this contract to rewarder based on rewardPercentage and burns the rest

```solidity
function distributeAndBurnSPA() public;

```

### **getUsdsOutForSpa**

Returns the amount of USDS for SPA amount in

```solidity
function getUsdsOutForSpa(uint256 _spaIn) public view returns (uint256);

```

**Parameters**

| Name    | Type    | Description          |
| ------- | ------- | -------------------- |
| \_spaIn | uint256 | Amount of SPA tokens |

**Returns**

| Name | Type    | Description                  |
| ---- | ------- | ---------------------------- |
|      | uint256 | Amount of USDs user will get |

### **\_getUsdsOutForSpa**

Returns the amount of USDS for SPA amount in

```solidity
function _getUsdsOutForSpa(uint256 _spaIn) private view returns (uint256, uint256);

```

**Parameters**

| Name    | Type    | Description          |
| ------- | ------- | -------------------- |
| \_spaIn | uint256 | Amount of SPA tokens |

**Returns**

| Name | Type    | Description                  |
| ---- | ------- | ---------------------------- |
|      | uint256 | Amount of USDs user will get |
|      | uint256 |                              |

### **\_getOracleData**

*Retrieves price data from the oracle contract for SPA and USDS tokens.*

```solidity
function _getOracleData() private view returns (uint256, uint256, uint256, uint256);

```

**Returns**

| Name | Type    | Description                                                                          |
| ---- | ------- | ------------------------------------------------------------------------------------ |
|      | uint256 | The price of USDS in SPA, the price of SPA in USDS, and their respective precisions. |
|      | uint256 |                                                                                      |
|      | uint256 |                                                                                      |
|      | uint256 |                                                                                      |

### **\_isValidRewardPercentage**

*Checks if the provided reward percentage is valid.*

*The reward percentage must be a non-zero value and should not exceed the maximum percentage value.*

```solidity
function _isValidRewardPercentage(uint256 _rewardPercentage) private pure;

```

**Parameters**

| Name               | Type    | Description                        |
| ------------------ | ------- | ---------------------------------- |
| \_rewardPercentage | uint256 | The reward percentage to validate. |

## **Events**

### **BoughtBack**

```solidity
event BoughtBack(
    address indexed receiverOfUSDs, address indexed senderOfSPA, uint256 spaPrice, uint256 spaAmount, uint256 usdsAmount
);

```

### **Withdrawn**

```solidity
event Withdrawn(address indexed token, address indexed receiver, uint256 amount);

```

### **SPARewarded**

```solidity
event SPARewarded(uint256 spaAmount);

```

### **SPABurned**

```solidity
event SPABurned(uint256 spaAmount);

```

### **RewardPercentageUpdated**

```solidity
event RewardPercentageUpdated(uint256 newRewardPercentage);

```

### **VeSpaRewarderUpdated**

```solidity
event VeSpaRewarderUpdated(address newVeSpaRewarder);

```

### **OracleUpdated**

```solidity
event OracleUpdated(address newOracle);

```

## **Errors**

### **CannotWithdrawSPA**

```solidity
error CannotWithdrawSPA();

```

### **InsufficientUSDsBalance**

```solidity
error InsufficientUSDsBalance(uint256 toSend, uint256 bal);
```


# MasterPriceOracle

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/oracle/MasterPriceOracle.sol)

**Inherits:** Ownable, IOracle

**Author:** Sperax Foundation

Communicates with different price feeds to get the price

## **State Variables**

### **tokenPriceFeed**

Store price feed data for tokens.

```solidity
mapping(address => PriceFeedData) public tokenPriceFeed;

```

## **Functions**

### **updateTokenPriceFeed**

Add/Update price feed for `_token`

*Have to be extra cautious while updating the price feed.*

```solidity
function updateTokenPriceFeed(address _token, address _source, bytes memory _data) external onlyOwner;

```

**Parameters**

| Name     | Type    | Description                            |
| -------- | ------- | -------------------------------------- |
| \_token  | address | address of the desired token.          |
| \_source | address | price feed source.                     |
| \_data   | bytes   | call data for fetching the price feed. |

### **removeTokenPriceFeed**

Remove an existing price feed for `_token`.

```solidity
function removeTokenPriceFeed(address _token) external onlyOwner;

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_token | address | address of the token. |

### **getPrice**

Gets the price feed for `_token`.

*Function reverts if the price feed does not exists.*

```solidity
function getPrice(address _token) external view returns (PriceData memory);

```

**Parameters**

| Name    | Type    | Description                   |
| ------- | ------- | ----------------------------- |
| \_token | address | address of the desired token. |

**Returns**

| Name | Type      | Description                         |
| ---- | --------- | ----------------------------------- |
|      | PriceData | (uint256 price, uint256 precision). |

### **priceFeedExists**

Validates if price feed exists for a `_token`

*Function reverts if price feed not set.*

```solidity
function priceFeedExists(address _token) external view returns (bool);

```

**Parameters**

| Name    | Type    | Description                   |
| ------- | ------- | ----------------------------- |
| \_token | address | address of the desired token. |

**Returns**

| Name | Type | Description                |
| ---- | ---- | -------------------------- |
|      | bool | bool if price feed exists. |

### **\_getPriceFeed**

Gets the price feed for a `_token` given the feed data.

```solidity
function _getPriceFeed(address _token, address _source, bytes memory _msgData)
    private
    view
    returns (PriceData memory priceData);

```

**Parameters**

| Name      | Type    | Description                   |
| --------- | ------- | ----------------------------- |
| \_token   | address | address of the desired token. |
| \_source  | address | price feed source.            |
| \_msgData | bytes   | call data for fetching feed.  |

**Returns**

| Name      | Type      | Description                         |
| --------- | --------- | ----------------------------------- |
| priceData | PriceData | (uint256 price, uint256 precision). |

## **Events**

### **PriceFeedUpdated**

```solidity
event PriceFeedUpdated(address indexed token, address indexed source, bytes msgData);

```

### **PriceFeedRemoved**

```solidity
event PriceFeedRemoved(address indexed token);

```

## **Errors**

### **InvalidAddress**

```solidity
error InvalidAddress();

```

### **UnableToFetchPriceFeed**

```solidity
error UnableToFetchPriceFeed(address token);

```

### **InvalidPriceFeed**

```solidity
error InvalidPriceFeed(address token);

```

### **PriceFeedNotFound**

```solidity
error PriceFeedNotFound(address token);
```


# Yield Reserve

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/buyback/YieldReserve.sol)

**Inherits:** ReentrancyGuard, Ownable

**Author:** Sperax Foundation

This contract allows users to swap supported stable-coins for yield earned by the USDs protocol. It sends USDs to the Dripper contract for rebase and to the Buyback Contract for buyback.

## **State Variables**

### **vault**

```solidity
address public vault;

```

### **oracle**

```solidity
address public oracle;

```

### **buyback**

```solidity
address public buyback;

```

### **dripper**

```solidity
address public dripper;

```

### **buybackPercentage**

```solidity
uint256 public buybackPercentage;

```

### **tokenData**

```solidity
mapping(address => TokenData) public tokenData;

```

## **Functions**

### **constructor**

Constructor of the YieldReserve contract.

```solidity
constructor(address _buyback, address _vault, address _oracle, address _dripper);

```

**Parameters**

| Name      | Type    | Description                      |
| --------- | ------- | -------------------------------- |
| \_buyback | address | Address of the Buyback contract. |
| \_vault   | address | Address of the Vault.            |
| \_oracle  | address | Address of the Oracle.           |
| \_dripper | address | Address of the Dripper contract. |

### **swap**

Swap function to be called by frontend users.

```solidity
function swap(address _srcToken, address _dstToken, uint256 _amountIn, uint256 _minAmountOut) external;

```

**Parameters**

| Name           | Type    | Description                     |
| -------------- | ------- | ------------------------------- |
| \_srcToken     | address | Source/Input token.             |
| \_dstToken     | address | Destination/Output token.       |
| \_amountIn     | uint256 | Input token amount.             |
| \_minAmountOut | uint256 | Minimum output tokens expected. |

### **toggleSrcTokenPermission**

Allow or disallow a specific `token` for use as a source/input token.

```solidity
function toggleSrcTokenPermission(address _token, bool _isAllowed) external onlyOwner;

```

**Parameters**

| Name        | Type    | Description                                                                                          |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------- |
| \_token     | address | Address of the token to be allowed or disallowed.                                                    |
| \_isAllowed | bool    | If set to true, the token will be allowed as a source/input token; otherwise, it will be disallowed. |

### **toggleDstTokenPermission**

Allow or disallow a specific `token` for use as a destination/output token.

*Reverts if caller is not owner.*

```solidity
function toggleDstTokenPermission(address _token, bool _isAllowed) external onlyOwner;

```

**Parameters**

| Name        | Type    | Description                                                                                                |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| \_token     | address | Address of the token to be allowed or disallowed.                                                          |
| \_isAllowed | bool    | If set to true, the token will be allowed as a destination/output token; otherwise, it will be disallowed. |

### **withdraw**

Emergency withdrawal function for unexpected situations.

```solidity
function withdraw(address _token, address _receiver, uint256 _amount) external onlyOwner;

```

**Parameters**

| Name       | Type    | Description                           |
| ---------- | ------- | ------------------------------------- |
| \_token    | address | Address of the asset to be withdrawn. |
| \_receiver | address | Address of the receiver of tokens.    |
| \_amount   | uint256 | Amount of tokens to be withdrawn.     |

### **updateBuybackPercentage**

Set the percentage of newly minted USDs to be sent to the Buyback contract.

*Reverts if caller is not owner.*

*The remaining USDs are sent to VaultCore for rebase.*

```solidity
function updateBuybackPercentage(uint256 _toBuyback) public onlyOwner;

```

**Parameters**

| Name        | Type    | Description                                                  |
| ----------- | ------- | ------------------------------------------------------------ |
| \_toBuyback | uint256 | The percentage of USDs sent to Buyback (e.g., 3000 for 30%). |

### **updateBuyback**

Update the address of the Buyback contract.

*Reverts if caller is not owner.*

```solidity
function updateBuyback(address _newBuyBack) public onlyOwner;

```

**Parameters**

| Name         | Type    | Description                          |
| ------------ | ------- | ------------------------------------ |
| \_newBuyBack | address | New address of the Buyback contract. |

### **updateOracle**

Update the address of the Oracle contract.

*Reverts if caller is not owner.*

```solidity
function updateOracle(address _newOracle) public onlyOwner;

```

**Parameters**

| Name        | Type    | Description                         |
| ----------- | ------- | ----------------------------------- |
| \_newOracle | address | New address of the Oracle contract. |

### **updateDripper**

Update the address of the Dripper contract.

*Reverts if caller is not owner.*

```solidity
function updateDripper(address _newDripper) public onlyOwner;

```

**Parameters**

| Name         | Type    | Description                          |
| ------------ | ------- | ------------------------------------ |
| \_newDripper | address | New address of the Dripper contract. |

### **updateVault**

Update the address of the VaultCore contract.

*Reverts if caller is not owner.*

```solidity
function updateVault(address _newVault) public onlyOwner;

```

**Parameters**

| Name       | Type    | Description                            |
| ---------- | ------- | -------------------------------------- |
| \_newVault | address | New address of the VaultCore contract. |

### **swap**

Swap allowed source token for allowed destination token.

```solidity
function swap(address _srcToken, address _dstToken, uint256 _amountIn, uint256 _minAmountOut, address _receiver)
    public
    nonReentrant;

```

**Parameters**

| Name           | Type    | Description                     |
| -------------- | ------- | ------------------------------- |
| \_srcToken     | address | Source/Input token.             |
| \_dstToken     | address | Destination/Output token.       |
| \_amountIn     | uint256 | Input token amount.             |
| \_minAmountOut | uint256 | Minimum output tokens expected. |
| \_receiver     | address | Receiver of the tokens.         |

### **mintUSDs**

Mints USDs directly with the allowed collaterals for USDs.

*Only collaterals configured in USDs vault are allowed to be used for minting.*

```solidity
function mintUSDs(address _token) public nonReentrant;

```

**Parameters**

| Name    | Type    | Description                        |
| ------- | ------- | ---------------------------------- |
| \_token | address | Address of token to mint USDs with |

### **getTokenBForTokenA**

Get an estimate of the output token amount for a given input token amount.

```solidity
function getTokenBForTokenA(address _srcToken, address _dstToken, uint256 _amountIn) public view returns (uint256);

```

**Parameters**

| Name       | Type    | Description                 |
| ---------- | ------- | --------------------------- |
| \_srcToken | address | Input token address.        |
| \_dstToken | address | Output token address.       |
| \_amountIn | uint256 | Input amount of \_srcToken. |

**Returns**

| Name | Type    | Description                    |
| ---- | ------- | ------------------------------ |
|      | uint256 | Estimated output token amount. |

### **\_sendUSDs**

Distributes USDs to the Buyback and Dripper contracts based on buybackPercentage.

*Sends a portion of the USDs balance to the Buyback contract and the remaining to the Dripper contract for rebase.*

```solidity
function _sendUSDs() private;

```

## **Events**

### **Swapped**

```solidity
event Swapped(
    address indexed srcToken, address indexed dstToken, address indexed dstReceiver, uint256 amountIn, uint256 amountOut
);

```

### **USDsMintedViaSwapper**

```solidity
event USDsMintedViaSwapper(address indexed collateralAddr, uint256 usdsMinted);

```

### **Withdrawn**

```solidity
event Withdrawn(address indexed token, address indexed receiver, uint256 amount);

```

### **BuybackPercentageUpdated**

```solidity
event BuybackPercentageUpdated(uint256 toBuyback);

```

### **BuybackUpdated**

```solidity
event BuybackUpdated(address newBuyback);

```

### **OracleUpdated**

```solidity
event OracleUpdated(address newOracle);

```

### **VaultUpdated**

```solidity
event VaultUpdated(address newVault);

```

### **DripperUpdated**

```solidity
event DripperUpdated(address newDripper);

```

### **USDsSent**

```solidity
event USDsSent(uint256 toBuyback, uint256 toDripper);

```

### **SrcTokenPermissionUpdated**

```solidity
event SrcTokenPermissionUpdated(address indexed token, bool isAllowed);

```

### **DstTokenPermissionUpdated**

```solidity
event DstTokenPermissionUpdated(address indexed token, bool isAllowed);

```

## **Errors**

### **InvalidSourceToken**

```solidity
error InvalidSourceToken();

```

### **InvalidDestinationToken**

```solidity
error InvalidDestinationToken();

```

### **AlreadyInDesiredState**

```solidity
error AlreadyInDesiredState();

```

### **TokenPriceFeedMissing**

```solidity
error TokenPriceFeedMissing();

```

## **Structs**

### **TokenData**

```solidity
struct TokenData {
    bool srcAllowed;
    bool dstAllowed;
    uint160 conversionFactor;
}
```


# Fee Calculator

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/vault/FeeCalculator.sol)

**Inherits:** IFeeCalculator

**Author:** Sperax Foundation

*A contract that calculates fees for minting and redeeming USDs.*

## **State Variables**

### **LOWER\_THRESHOLD**

```solidity
uint16 private constant LOWER_THRESHOLD = 5000;

```

### **UPPER\_THRESHOLD**

```solidity
uint16 private constant UPPER_THRESHOLD = 15000;

```

### **DISCOUNT\_FACTOR**

```solidity
uint16 private constant DISCOUNT_FACTOR = 2;

```

### **PENALTY\_MULTIPLIER**

```solidity
uint16 private constant PENALTY_MULTIPLIER = 2;

```

### **CALIBRATION\_GAP**

```solidity
uint32 private constant CALIBRATION_GAP = 1 days;

```

### **COLLATERAL\_MANAGER**

```solidity
ICollateralManager public immutable COLLATERAL_MANAGER;

```

### **collateralFee**

```solidity
mapping(address => FeeData) public collateralFee;

```

## **Functions**

### **constructor**

```solidity
constructor(address _collateralManager);

```

### **calibrateFee**

Calibrates fee for a particular collateral

```solidity
function calibrateFee(address _collateral) external;

```

**Parameters**

| Name         | Type    | Description                       |
| ------------ | ------- | --------------------------------- |
| \_collateral | address | Address of the desired collateral |

### **getMintFee**

Calculates fee to be collected for minting

```solidity
function getMintFee(address _collateral) external view returns (uint256);

```

**Parameters**

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| \_collateral | address |             |

**Returns**

| Name | Type    | Description         |
| ---- | ------- | ------------------- |
|      | uint256 | (uint256) baseFeeIn |

### **getRedeemFee**

Calculates fee to be collected for redeeming

```solidity
function getRedeemFee(address _collateral) external view returns (uint256);

```

**Parameters**

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| \_collateral | address |             |

**Returns**

| Name | Type    | Description          |
| ---- | ------- | -------------------- |
|      | uint256 | (uint256) baseFeeOut |

### **calibrateFeeForAll**

Calibrates fee for all the collaterals registered

```solidity
function calibrateFeeForAll() public;

```

### **\_calibrateFee**

Helper function for calibrating fee for a collateral

```solidity
function _calibrateFee(address _collateral) private;

```

**Parameters**

| Name         | Type    | Description                       |
| ------------ | ------- | --------------------------------- |
| \_collateral | address | Address of the desired collateral |

## **Events**

### **FeeCalibrated**

```solidity
event FeeCalibrated(address indexed collateral, uint16 mintFee, uint16 redeemFee);

```

## **Errors**

### **InvalidCalibration**

```solidity
error InvalidCalibration();

```

## **Structs**

### **FeeData**

```solidity
struct FeeData {
    uint32 nextUpdate;
    uint16 mintFee;
    uint16 redeemFee;
}
```


# RebaseManager

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/rebase/RebaseManager.sol)

**Inherits:** IRebaseManager, Ownable

**Author:** Sperax Foundation

This contract handles the configuration and execution of the rebasing mechanism for the USDs stablecoin. It ensures that rebases occur only when certain prerequisites are fulfilled, such as the time gap between rebases and acceptable APR (Annual Percentage Rate) ranges.

*The Rebase Manager coordinates with the Vault and Dripper contracts to manage the rebase process.*

## **State Variables**

### **ONE\_YEAR**

```solidity
uint256 private constant ONE_YEAR = 365 days;

```

### **vault**

```solidity
address public vault;

```

### **dripper**

```solidity
address public dripper;

```

### **gap**

```solidity
uint256 public gap;

```

### **aprCap**

```solidity
uint256 public aprCap;

```

### **aprBottom**

```solidity
uint256 public aprBottom;

```

### **lastRebaseTS**

```solidity
uint256 public lastRebaseTS;

```

## **Functions**

### **onlyVault**

```solidity
modifier onlyVault();

```

### **constructor**

Constructor to initialize the Rebase Manager

```solidity
constructor(address _vault, address _dripper, uint256 _gap, uint256 _aprCap, uint256 _aprBottom);

```

**Parameters**

| Name        | Type    | Description                                               |
| ----------- | ------- | --------------------------------------------------------- |
| \_vault     | address | Address of the vault contract                             |
| \_dripper   | address | Address of the dripper contract for collecting USDs       |
| \_gap       | uint256 | Minimum time gap required between two consecutive rebases |
| \_aprCap    | uint256 | Maximum allowed APR for a rebase                          |
| \_aprBottom | uint256 | Minimum allowed APR for a rebase                          |

### **fetchRebaseAmt**

Get the current amount valid for rebase

*Function is called by the vault while rebasing*

```solidity
function fetchRebaseAmt() external onlyVault returns (uint256);

```

**Returns**

| Name | Type    | Description                            |
| ---- | ------- | -------------------------------------- |
|      | uint256 | The available amount for rebasing USDs |

### **updateVault**

Updates the vault address

```solidity
function updateVault(address _newVault) public onlyOwner;

```

**Parameters**

| Name       | Type    | Description                       |
| ---------- | ------- | --------------------------------- |
| \_newVault | address | Address of the new vault contract |

### **updateDripper**

Updates the dripper contract for USDs vault

```solidity
function updateDripper(address _dripper) public onlyOwner;

```

**Parameters**

| Name      | Type    | Description                         |
| --------- | ------- | ----------------------------------- |
| \_dripper | address | Address of the new dripper contract |

### **updateGap**

Update the minimum time gap required between two rebases

```solidity
function updateGap(uint256 _gap) public onlyOwner;

```

**Parameters**

| Name  | Type    | Description      |
| ----- | ------- | ---------------- |
| \_gap | uint256 | Updated gap time |

### **updateAPR**

Update the APR requirements for each rebase

```solidity
function updateAPR(uint256 _aprBottom, uint256 _aprCap) public onlyOwner;

```

**Parameters**

| Name        | Type    | Description                  |
| ----------- | ------- | ---------------------------- |
| \_aprBottom | uint256 | New minimum APR for a rebase |
| \_aprCap    | uint256 | New maximum APR for a rebase |

### **getAvailableRebaseAmt**

Gets the current available rebase fund

```solidity
function getAvailableRebaseAmt() public view returns (uint256);

```

**Returns**

| Name | Type    | Description                                                       |
| ---- | ------- | ----------------------------------------------------------------- |
|      | uint256 | Current balance in the vault plus collectable dripped USDs amount |

### **getMinAndMaxRebaseAmt**

Gets the minimum and maximum rebase USDs amount based on the APR config

```solidity
function getMinAndMaxRebaseAmt() public view returns (uint256, uint256);

```

**Returns**

| Name | Type    | Description                        |
| ---- | ------- | ---------------------------------- |
|      | uint256 | Minimum and maximum rebase amounts |
|      | uint256 |                                    |

## **Events**

### **VaultUpdated**

```solidity
event VaultUpdated(address vault);

```

### **DripperUpdated**

```solidity
event DripperUpdated(address dripper);

```

### **GapUpdated**

```solidity
event GapUpdated(uint256 gap);

```

### **APRUpdated**

```solidity
event APRUpdated(uint256 aprBottom, uint256 aprCap);

```

## **Errors**

### **CallerNotVault**

```solidity
error CallerNotVault(address caller);

```

### **InvalidAPRConfig**

```solidity
error InvalidAPRConfig(uint256 aprBottom, uint256 aprCap);
```


# Dripper

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/rebase/Dripper.sol)

**Inherits:** IDripper, Ownable

**Author:** Sperax Foundation

This contract releases tokens at a steady rate to the Vault contract, for rebasing the USDs stablecoin.

*The Dripper contract ensures that tokens are released gradually over time, allowing for consistent and controlled distribution.*

## **State Variables**

### **vault**

```solidity
address public vault;

```

### **dripRate**

```solidity
uint256 public dripRate;

```

### **dripDuration**

```solidity
uint256 public dripDuration;

```

### **lastCollectTS**

```solidity
uint256 public lastCollectTS;

```

## **Functions**

### **constructor**

Constructor to initialize the Dripper.

```solidity
constructor(address _vault, uint256 _dripDuration);

```

**Parameters**

| Name           | Type    | Description                                               |
| -------------- | ------- | --------------------------------------------------------- |
| \_vault        | address | Address of the contract that receives the dripped tokens. |
| \_dripDuration | uint256 | The duration over which tokens are dripped.               |

### **recoverTokens**

Emergency fund recovery function.

*Transfers the asset to the owner of the contract.*

```solidity
function recoverTokens(address _asset) external onlyOwner;

```

**Parameters**

| Name    | Type    | Description                      |
| ------- | ------- | -------------------------------- |
| \_asset | address | Address of the asset to recover. |

### **addUSDs**

Function to be used to send USDs to dripper and update `dripRate`.

```solidity
function addUSDs(uint256 _amount) external;

```

**Parameters**

| Name     | Type    | Description                                             |
| -------- | ------- | ------------------------------------------------------- |
| \_amount | uint256 | Amount of USDs to be sent form caller to this contract. |

### **collect**

Transfers the dripped tokens to the vault.

*This function also updates the dripRate based on the fund state.*

```solidity
function collect() public returns (uint256);

```

**Returns**

| Name | Type    | Description                                                  |
| ---- | ------- | ------------------------------------------------------------ |
|      | uint256 | The amount of tokens collected and transferred to the vault. |

### **updateVault**

Update the vault address.

```solidity
function updateVault(address _vault) public onlyOwner;

```

**Parameters**

| Name    | Type    | Description                        |
| ------- | ------- | ---------------------------------- |
| \_vault | address | Address of the new vault contract. |

### **updateDripDuration**

Updates the dripDuration.

```solidity
function updateDripDuration(uint256 _dripDuration) public onlyOwner;

```

**Parameters**

| Name           | Type    | Description                          |
| -------------- | ------- | ------------------------------------ |
| \_dripDuration | uint256 | The desired drip duration to be set. |

### **getCollectableAmt**

Gets the collectible amount of tokens at the current time.

```solidity
function getCollectableAmt() public view returns (uint256);

```

**Returns**

| Name | Type    | Description                                 |
| ---- | ------- | ------------------------------------------- |
|      | uint256 | The amount of tokens that can be collected. |

## **Events**

### **Collected**

```solidity
event Collected(uint256 amount);

```

### **Recovered**

```solidity
event Recovered(address owner, uint256 amount);

```

### **VaultUpdated**

```solidity
event VaultUpdated(address vault);

```

### **DripDurationUpdated**

```solidity
event DripDurationUpdated(uint256 dripDuration);

```

### **USDsAdded**

```solidity
event USDsAdded(uint256 _amount);

```

## **Errors**

### **NothingToRecover**

```solidity
error NothingToRecover();
```


# BaseStrategy

[Git Source](https://github.com/Sperax/USDs-v2/blob/ff71faf9d7e40d2b2764e5e8f2acc631f31489aa/contracts/strategies/InitializableAbstractStrategy.sol)

**Inherits:** Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable

**Author:** Sperax Foundation

*Contract acts as a single interface for implementing specific yield-earning strategies.*

## **State Variables**

### **vault**

```solidity
address public vault;

```

### **withdrawSlippage**

```solidity
uint16 public withdrawSlippage;

```

### **depositSlippage**

```solidity
uint16 public depositSlippage;

```

### **harvestIncentiveRate**

```solidity
uint16 public harvestIncentiveRate;

```

### **assetsMapped**

```solidity
address[] internal assetsMapped;

```

### **rewardTokenAddress**

```solidity
address[] public rewardTokenAddress;

```

### **assetToPToken**

```solidity
mapping(address => address) public assetToPToken;

```

### **gap**

```solidity
uint256[40] private __gap__;

```

## **Functions**

### **onlyVault**

```solidity
modifier onlyVault();

```

### **onlyVaultOrOwner**

```solidity
modifier onlyVaultOrOwner();

```

### **constructor**

```solidity
constructor();

```

### **updateVault**

Update the linked vault contract.

```solidity
function updateVault(address _newVault) external onlyOwner;

```

**Parameters**

| Name       | Type    | Description               |
| ---------- | ------- | ------------------------- |
| \_newVault | address | Address of the new Vault. |

### **updateHarvestIncentiveRate**

Updates the HarvestIncentive rate for the user.

```solidity
function updateHarvestIncentiveRate(uint16 _newRate) external onlyOwner;

```

**Parameters**

| Name      | Type   | Description       |
| --------- | ------ | ----------------- |
| \_newRate | uint16 | new Desired rate. |

### **recoverERC20**

A function to recover any erc20 token sent to this strategy mistakenly.

*Only callable by owner.*

*reverts if amount > balance.*

```solidity
function recoverERC20(address token, address receiver, uint256 amount) external onlyOwner;

```

**Parameters**

| Name     | Type    | Description             |
| -------- | ------- | ----------------------- |
| token    | address | Address of the token.   |
| receiver | address | Receiver of the token.  |
| amount   | uint256 | Amount to be recovered. |

### **deposit**

*Deposit an amount of asset into the platform.*

```solidity
function deposit(address _asset, uint256 _amount) external virtual;

```

**Parameters**

| Name     | Type    | Description                |
| -------- | ------- | -------------------------- |
| \_asset  | address | Address for the asset.     |
| \_amount | uint256 | Units of asset to deposit. |

### **withdraw**

*Withdraw an amount of asset from the platform.*

```solidity
function withdraw(address _recipient, address _asset, uint256 _amount)
    external
    virtual
    returns (uint256 amountReceived);

```

**Parameters**

| Name        | Type    | Description                                |
| ----------- | ------- | ------------------------------------------ |
| \_recipient | address | Address to which the asset should be sent. |
| \_asset     | address | Address of the asset.                      |
| \_amount    | uint256 | Units of asset to withdraw.                |

**Returns**

| Name           | Type    | Description                 |
| -------------- | ------- | --------------------------- |
| amountReceived | uint256 | The actual amount received. |

### **withdrawToVault**

*Withdraw an amount of asset from the platform to vault.*

```solidity
function withdrawToVault(address _asset, uint256 _amount) external virtual returns (uint256 amount);

```

**Parameters**

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| \_asset  | address | Address of the asset.       |
| \_amount | uint256 | Units of asset to withdraw. |

### **collectInterest**

Withdraw the interest earned of asset from the platform.

```solidity
function collectInterest(address _asset) external virtual;

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_asset | address | Address of the asset. |

### **collectReward**

Collect accumulated reward token and send to Vault.

```solidity
function collectReward() external virtual;

```

### **checkBalance**

Get the amount of a specific asset held in the strategy, excluding the interest.

*Curve: assuming balanced withdrawal.*

```solidity
function checkBalance(address _asset) external view virtual returns (uint256);

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_asset | address | Address of the asset. |

**Returns**

| Name | Type    | Description                                 |
| ---- | ------- | ------------------------------------------- |
|      | uint256 | uint256 Balance of \_asset in the strategy. |

### **checkAvailableBalance**

Get the amount of a specific asset held in the strategy, excluding the interest and any locked liquidity that is not available for instant withdrawal.

*Curve: assuming balanced withdrawal.*

```solidity
function checkAvailableBalance(address _asset) external view virtual returns (uint256);

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_asset | address | Address of the asset. |

**Returns**

| Name | Type    | Description                                                |
| ---- | ------- | ---------------------------------------------------------- |
|      | uint256 | uint256 Available balance inside the strategy for \_asset. |

### **checkInterestEarned**

AAVE: Get the interest earned on a specific asset. Curve: Get the total interest earned.

*Curve: to avoid double-counting, \_asset has to be of index 'entryTokenIndex'.*

```solidity
function checkInterestEarned(address _asset) external view virtual returns (uint256);

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_asset | address | Address of the asset. |

**Returns**

| Name | Type    | Description                        |
| ---- | ------- | ---------------------------------- |
|      | uint256 | uint256 Amount of interest earned. |

### **checkRewardEarned**

Get the amount of claimable reward.

```solidity
function checkRewardEarned() external view virtual returns (RewardData[] memory);

```

**Returns**

| Name | Type          | Description                                                      |
| ---- | ------------- | ---------------------------------------------------------------- |
|      | RewardData\[] | struct array of type RewardData (address token, uint256 amount). |

### **checkLPTokenBalance**

Get the total LP token balance for a asset.

```solidity
function checkLPTokenBalance(address _asset) external view virtual returns (uint256);

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_asset | address | Address of the asset. |

### **supportsCollateral**

Check if an asset/collateral is supported.

```solidity
function supportsCollateral(address _asset) external view virtual returns (bool);

```

**Parameters**

| Name    | Type    | Description           |
| ------- | ------- | --------------------- |
| \_asset | address | Address of the asset. |

**Returns**

| Name | Type | Description                      |
| ---- | ---- | -------------------------------- |
|      | bool | bool Whether asset is supported. |

### **updateSlippage**

Change to a new depositSlippage & withdrawSlippage.

```solidity
function updateSlippage(uint16 _depositSlippage, uint16 _withdrawSlippage) public onlyOwner;

```

**Parameters**

| Name               | Type   | Description                        |
| ------------------ | ------ | ---------------------------------- |
| \_depositSlippage  | uint16 | Slippage tolerance for allocation. |
| \_withdrawSlippage | uint16 | Slippage tolerance for withdrawal. |

### **\_initialize**

Initialize the base properties of the strategy.

```solidity
function _initialize(address _vault, uint16 _depositSlippage, uint16 _withdrawSlippage) internal;

```

**Parameters**

| Name               | Type    | Description                        |
| ------------------ | ------- | ---------------------------------- |
| \_vault            | address | Address of the USDs Vault.         |
| \_depositSlippage  | uint16  | Allowed max slippage for Deposit.  |
| \_withdrawSlippage | uint16  | Allowed max slippage for withdraw. |

### **\_setPTokenAddress**

Provide support for asset by passing its pToken address. Add to internal mappings and execute the platform specific, abstract method `_abstractSetPToken`.

```solidity
function _setPTokenAddress(address _asset, address _pToken) internal;

```

**Parameters**

| Name     | Type    | Description                                   |
| -------- | ------- | --------------------------------------------- |
| \_asset  | address | Address for the asset.                        |
| \_pToken | address | Address for the corresponding platform token. |

### **\_removePTokenAddress**

Remove a supported asset by passing its index. This method can only be called by the system owner.

```solidity
function _removePTokenAddress(uint256 _assetIndex) internal returns (address asset);

```

**Parameters**

| Name         | Type    | Description                       |
| ------------ | ------- | --------------------------------- |
| \_assetIndex | uint256 | Index of the asset to be removed. |

**Returns**

| Name  | Type    | Description               |
| ----- | ------- | ------------------------- |
| asset | address | address which is removed. |

### **\_splitAndSendReward**

Splits and sends the accumulated rewards to harvestor and yield receiver.

*Sends the amount to harvestor as per `harvestIncentiveRate` and sends the rest to yield receiver.*

```solidity
function _splitAndSendReward(address _token, address _yieldReceiver, address _harvestor, uint256 _amount)
    internal
    returns (uint256);

```

**Parameters**

| Name            | Type    | Description                    |
| --------------- | ------- | ------------------------------ |
| \_token         | address | Address of the reward token.   |
| \_yieldReceiver | address | Address of the yield receiver. |
| \_harvestor     | address | Address of the harvestor.      |
| \_amount        | uint256 | to be split and sent.          |

**Returns**

| Name | Type    | Description                                      |
| ---- | ------- | ------------------------------------------------ |
|      | uint256 | uint256 Harvested amount sent to yield receiver. |

### **\_abstractSetPToken**

Call the necessary approvals for the underlying strategy.

```solidity
function _abstractSetPToken(address _asset, address _pToken) internal virtual;

```

**Parameters**

| Name     | Type    | Description                                 |
| -------- | ------- | ------------------------------------------- |
| \_asset  | address | Address of the asset.                       |
| \_pToken | address | Address of the corresponding receipt token. |

## **Events**

### **VaultUpdated**

```solidity
event VaultUpdated(address newVaultAddr);

```

### **YieldReceiverUpdated**

```solidity
event YieldReceiverUpdated(address newYieldReceiver);

```

### **PTokenAdded**

```solidity
event PTokenAdded(address indexed asset, address pToken);

```

### **PTokenRemoved**

```solidity
event PTokenRemoved(address indexed asset, address pToken);

```

### **Deposit**

```solidity
event Deposit(address indexed asset, uint256 amount);

```

### **Withdrawal**

```solidity
event Withdrawal(address indexed asset, uint256 amount);

```

### **SlippageUpdated**

```solidity
event SlippageUpdated(uint16 depositSlippage, uint16 withdrawSlippage);

```

### **HarvestIncentiveCollected**

```solidity
event HarvestIncentiveCollected(address indexed token, address indexed harvestor, uint256 amount);

```

### **HarvestIncentiveRateUpdated**

```solidity
event HarvestIncentiveRateUpdated(uint16 newRate);

```

### **InterestCollected**

```solidity
event InterestCollected(address indexed asset, address indexed recipient, uint256 amount);

```

### **RewardTokenCollected**

```solidity
event RewardTokenCollected(address indexed rwdToken, address indexed recipient, uint256 amount);

```

## **Errors**

### **CallerNotVault**

```solidity
error CallerNotVault(address caller);

```

### **CallerNotVaultOrOwner**

```solidity
error CallerNotVaultOrOwner(address caller);

```

### **PTokenAlreadySet**

```solidity
error PTokenAlreadySet(address collateral, address pToken);

```

### **InvalidIndex**

```solidity
error InvalidIndex();

```

### **CollateralNotSupported**

```solidity
error CollateralNotSupported(address asset);

```

### **InvalidAssetLpPair**

```solidity
error InvalidAssetLpPair(address asset, address lpToken);

```

### **CollateralAllocated**

```solidity
error CollateralAllocated(address asset);

```

## **Structs**

### **RewardData**

```solidity
struct RewardData {
    address token;
    uint256 amount;
}
```


# Deployed contracts

<table><thead><tr><th width="214">Name</th><th width="563">Explorer link</th></tr></thead><tbody><tr><td>USDs</td><td><a href="https://arbiscan.io/address/0xD74f5255D557944cf7Dd0E45FF521520002D5748">https://arbiscan.io/address/0xD74f5255D557944cf7Dd0E45FF521520002D5748</a></td></tr><tr><td>Vault</td><td><a href="https://arbiscan.io/address/0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca">https://arbiscan.io/address/0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca</a></td></tr><tr><td>CollateralManager</td><td><a href="https://arbiscan.io/address/0xdA423BFa1E196598190deEfbAFC28aDb36FaeDF0">https://arbiscan.io/address/0xdA423BFa1E196598190deEfbAFC28aDb36FaeDF0</a></td></tr><tr><td>FeeCalculator</td><td><a href="https://arbiscan.io/address/0xd122840Fa5b48B2ddB723cCC5928f88dcb558AFC">https://arbiscan.io/address/0xd122840Fa5b48B2ddB723cCC5928f88dcb558AFC</a></td></tr><tr><td>MasterPrice Oracle</td><td><a href="https://arbiscan.io/address/0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50">https://arbiscan.io/address/0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50</a></td></tr><tr><td>SPABuyback</td><td><a href="https://arbiscan.io/address/0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3">https://arbiscan.io/address/0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3</a></td></tr><tr><td>YieldReserve</td><td><a href="https://arbiscan.io/address/0xfD14C8ef0993fd9409f7820BA8BA80370529d861">https://arbiscan.io/address/0xfD14C8ef0993fd9409f7820BA8BA80370529d861</a></td></tr><tr><td>Dripper</td><td><a href="https://arbiscan.io/address/0xd50193e8fFb00beA274bD2b11d0a7Ea08dA044c1">https://arbiscan.io/address/0xd50193e8fFb00beA274bD2b11d0a7Ea08dA044c1</a></td></tr><tr><td>RebaseManager</td><td><a href="https://arbiscan.io/address/0x297331A0155B1e30bBFA85CF3609eC0fF037BEEC">https://arbiscan.io/address/0x297331A0155B1e30bBFA85CF3609eC0fF037BEEC</a></td></tr><tr><td>AaveStrategy</td><td><a href="https://arbiscan.io/address/0x974993ee8df7f5c4f3f9aa4eb5b4534f359f3388">https://arbiscan.io/address/0x974993ee8df7f5c4f3f9aa4eb5b4534f359f3388</a></td></tr><tr><td>StargateStrategy </td><td><a href="https://arbiscan.io/address/0xb9c9100720d8c6e35eb8dd0f9c1abef320daa136">https://arbiscan.io/address/0xb9c9100720d8c6e35eb8dd0f9c1abef320daa136</a></td></tr><tr><td>CompoundStrategy</td><td><a href="https://arbiscan.io/address/0xBCeb48625771E35420076f79Ec6921E783a82442">https://arbiscan.io/address/0xBCeb48625771E35420076f79Ec6921E783a82442</a></td></tr></tbody></table>


# Buyback Contract

Buyback contract is designed to decentralize the SPA buyback process while adding a boosting mechanism to continuously grow USDs TVL with protocol revenue (Yield + Fee). This contract allows users to directly purchase USDs with SPA. The available-for-purchase USDs comes from two sources - USDs mint/redeem fees and USDs yield. The contract distributes 70% of the yield to USDs holders and the rest 30% goes to SPA buyback and burn.

1. **Protocol Yield** - The yield is collected in multiple tokens through pool fee (USDC, etc.) and farm rewards. This yield is converted to USDs. A portion is sent to buyback contract and remaining to auto-yield reserve.
   * Swap yield tokens to eligible collateral tokens (for minting USDs) using DEXes based on the path of lowest slippage
   * Mint USDs using the collateral tokens
   * Deposit 30% of the yield (USDs received in previous step) that will be used to buyback SPA into the buyback contract and the rest of the USDs is transferred back to the USDs vault’s auto-yield reserve. Yield share percentage is set to 30% currently and can be changed in future through governance.
2. **Protocol Fee** - Mint and redemption fee from the USDs protocol is collected in the form of USDs. This component is directly deposited to the Buyback contract.
3. **Buyback SPA** - Any users or external wallet can view the USDs balance in the Buyback contract and sell their SPA tokens for USDs.
4. **Burn 2.0** - 30% of the SPA received in step 3 is burnt and remaining 70% is sent to USDs holding wallets. The burn percentage can be changed through governance.

#### Example flow of the buyback contract:&#x20;

Sperax protocol deposits USDC.e to Stargate strategy (Stargate-LP USDC.e) and stakes LP tokens. Protocol earns STG token.

1. Sell STG tokens for USDC.e
2. Mint USDs from USDC.e
3. Transfer USDs to the Buyback contract
4. Deposit USDs Mint and Redemption Fees directly into the Buyback contract as and when they are collected
5. Users can view the amount of USDs left in the contract.
6. USDs is bought by the users using their SPA and contract receives SPA against the USDs.

## Technical Specification

### Buyback Architecture

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FhZws21oNAJBFOsCAEm7x%2FStrategies%20(2).png?alt=media&#x26;token=fa149545-fb6c-4344-85db-b249e8317ae8" alt=""><figcaption></figcaption></figure>

### View Functions

1. **getSPAReqdForUSDs** - Input the target USDs amount to receive and get an estimate of how many SPA tokens are needed.&#x20;
   1. Function: getSPAReqdForUSDs(uint256 \_usdsAmount) external view returns (uint256)
   2. Input : \_usdsAmount is the amount of USDs to purchase&#x20;
   3. Output: Estimated amount of SPA required&#x20;
   4. Example: Suppose getSPAReqdForUSDs(1e18) returns 100\*1e18. It means the contract estimates that one will need to speed 100 SPA to purchase 1 USDs at this moment.
2. **getUsdsOutForSpa** - Input the amount of SPA to be sold and get an estimate of how many USDs can be purchased.&#x20;
   1. Function: getUsdsOutForSpa(uint256 \_spaIn) external view returns (uint256)&#x20;
   2. Input : \_spaIn is the amount of SPA to be sold&#x20;
   3. Output: Estimated amount of USDs to be received&#x20;
   4. Example: Suppose getSPAReqdForUSDs(100\*1e18) returns 1e18. It means the contract estimates that one will receive 1 USDs after spending 100 SPA.

### **User End Write** Functions

1. **buyUSDs** - Purchase USDs with SPA&#x20;
   1. Function: buyUSDs(uint256 \_spaIn, uint256 \_minUSDsOut) external&#x20;
   2. Input : \_spaIn is the amount of SPA to be sold \_minUSDsOut is the minimum amount of USDs to be received&#x20;
   3. Output : The contract will extract \_spaIn amount of SPA from the wallet executing the transaction, exchange it to USDs, and send USDs back to the wallet&#x20;
   4. Example : Suppose wallet A triggers buyUSDs(100\*1e18, 1e18) (after he has already approved the Buyback contract to spend its SPA). The contract will extract 100 SPA from A, exchange it to USDs, and send USDs back to A.
2. **buyUSDs** - Purchase USDs with SPA (arbitrary USDs receipt)&#x20;
   1. Function: buyUSDs(address \_receiver, uint256 \_spaIn, uint256 \_minUSDsOut) external
   2. Input : \_receiver is the receiver of the purchased USDs \_spaIn is the amount of SPA to be sold \_minUSDsOut is the minimum amount of USDs to be received&#x20;
   3. Output : The contract will extract \_spaIn amount of SPA from the wallet executing the transaction, exchange it to USDs, and send USDs to the \_receiver wallet&#x20;
   4. Example : Suppose wallet A triggers buyUSDs(B, 100\*1e18, 1e18) (after he has already approved the Buyback contract to spend its SPA). The contract will extract 100 SPA from A, exchange it to USDs, and send USDs to B.


# Staking Protocol

Stake SPA to earn rewards from fees and yield

SPA holders can stake SPA tokens and receive veSPA tokens which are non-transferable. veSPA balance is proportional to the lockup period, meaning if user locks up for higher duration they receive proportionally more veSPA tokens. veSPA balance determines the share of staking reward and voting power

1. **Staking rewards**: Rewards will be distributed proportionally to the user's veSPA balance. Users who lock SPA for longer periods are eligible for proportionally more rewards (accrued on a weekly base) than users who locked the same amount of SPA for shorter periods. Rewards are accumulated through:

   * As per [SIP-66](https://snapshot.box/#/s:speraxdao.eth/proposal/0x401841b87ef3b503e8732eaace2b867faab15b91383e94bad9c90ec61e2540cd), the emission of xSPA for veSPA holders has been increased to 420,000 xSPA tokens per week from the treasury to account for the decrement in APR due to cutting the allocation from bought-back SPA.
   * **Fee Rewards** - 100% of the Fee income from USDs mints and redemptions.

   The yield and fee income are originally generated in USDs. It is then swapped for SPA tokens before distribution. This makes the reward claiming process simple for stakers and maintains a constant buying pressure on the SPA token.
2. **Voting power**: once governance protocol is launched, voting power will depend on users' veSPA balance. Users who are committed to longer lockups will own more votes, whatever they are voting for.

veSPA balance at the moment of staking will not stay the same all the time - it will decay/reduce linearly. User's rewards per week and voting power will also decrease over time, together with the veSPA balance. Stakers can increase their veSPA balance and thereby their staking rewards and voting power by either extending the locking period or locking more SPA or re-staking SPA rewards.

At the end of the lockup period, veSPA balance will reduce depending on the pre-selected withdrawal option:

1. For Auto-cooldown option - to zero.
2. For the "Staying Staked" option (manual cooldown) - to \[0.01917\*staked SPA tokens]. Please note that for new stakers the "Staying Staked option" is not available.

To stake SPA through our dApp, checkout [staking-spa](https://docs.sperax.io/getting-started-on-our-dapp/staking-spa "mention")


# Locking SPA

veSPA is SPA locked with the "vote escrow" mechanism (ve-). This is the mechanism of locking tokens for relatively long pre-defined time periods. On staking SPA, the staker receives non-tranferrable tokens veSPA.

The veSPA balance will depend on the amount of SPA tokens locked and the user's chosen lockup period. Stakers can lock their tokens for a maximum of 4 years or a minimum of 7 days. A higher lockup period means a higher veSPA balance for the same amount of SPA staked.

**veSPA value = SPA tokens staked \* (Lockup Period in days / 365)**

Below table shows how veSPA value will be determined

| Lock-up Period | SPA Tokens staked | veSPA value |
| :------------: | :---------------: | :---------: |
|     4 year     |         1         |      4      |
|     3 year     |         1         |      3      |
|     2 year     |         1         |      2      |
|     1 year     |         1         |      1      |
|    6 months    |         1         |     0.5     |

**veSPA balance will decay linearly with time**. At the end of lockup period, veSPA balance will reduce to 0 or (0.01917\*staked SPA tokens) based on the withdrawal method user chooses while staking the SPA. Two withdrawal methods were available to the early stakers, they will work till the end of their lockup period. For all the new stakers method 1 (Auto-cooldown) stays the only available method.

1. **Auto-cooldown** - veSPA balance reduces to 0 at the end of lockup period and staker is able to withdraw locked SPA balance immediately after expiry date
2. **Stay Staked at Residual Value** - Stakers can opt to remain staked at the end of the unlock date at a residual veSPA balance (0.01917\*staked SPA tokens). They can initiate cooldown when 7 days are left in the staking period or anytime after. After the cooldown period of 7 days is over, they can withdraw the staked SPA tokens. Check out[#stay-staked-at-residual-value](https://docs.sperax.io/withdrawing-spa#stay-staked-at-residual-value "mention")for more details.

<details>

<summary>Example of veSPA balance decay over time</summary>

User stakes 1000 SPA for 4 years&#x20;

* At Day 0 user will have 4000 veSPA
* At day 365 user will have 3000 veSPA&#x20;
* At day 365\*2 user will have 2000 veSPA
* At day 365\*3 user will have 1000 veSPA
* At Day 365\*4 user will have 0 veSPA or 19.17 veSPA depending on withdrawal method chosen

</details>

Some important points to consider before locking your SPA tokens:&#x20;

1. Staking is an irreversible process, once locked the tokens cannot be unlocked before the unlock date. Users cannot prepone the expiry date or reduce the amount of locked SPA.
2. Due to precision issues it may not always be possible to choose an exact unlock date. Users can select the lockup period but the exact unlock date is rounded down to nearest Thursday UTC. Stakers will be able to choose these eligible unlock dates in our [dapp](https://app.sperax.io/veSpaStake).
3. Users rewards per week and voting power will also decrease over time, together with the veSPA balance. The users who are committed to long-term staking can increase their rewards per week and voting power by:
   * Extending the locking period
   * Locking more SPA
   * Claiming SPA staking rewards and restaking them into veSPA (compounding)

## Extension of Lockup

Stakers can extend their lockup such that the lockup expiry date is <= 4 years from the current date. At no point, lockup period can be more than 4 years.&#x20;

&#x20;The lockup period cannot be extended in the following scenarios:&#x20;

1. When a staker’s lockup period has expired and they only have residual veSPA balance&#x20;
2. When a staker has already initiated cooldown period Example: If a user has 100 veSPA tokens which expire in 3 years, the user can increase the lockup by a maximum of 1 year.

## Increasing Staked Balance

Users can also increase their veSPA balance by staking any additional amount of SPA tokens for the same lockup as their existing veSPA balance.&#x20;

Example: if a user has 100 veSPA tokens which are expiring in 34 days, they can stake any amount of additional SPA for 34 days. The increase in veSPA balance will be calculated based on the same lockup period as the previously staked tokens.


# Withdrawing SPA

Users who initiate staking will get the **auto-cooldown** feature.  Users who initiated staking in the past were able select one of two cooldown options that will stay active till the end of the staking period:

1. **Auto-cooldown**: the protocol will automatically initiate a cooldown 7 days before expiry. In this case, the assets will be available immediately after the lock period, but they will not bring any more rewards post-expiry.
2. **Stay staked at residual value (or manual cooldown)**: After the lock expires, the assets remain locked with the residual value of \[0.01917\*staked SPA tokens], and will continue to bring rewards to the user. If one day the user decides to take their assets out - they need to initiate the cooldown manually. After a one-week cooldown, the assets will become available.

Withdrawing from the protocol does not automatically claim all the SPA rewards. The users would be required to claim the rewards separately. In case the staking rewards are not distributed till that point of time, users can still claim the rewards and fee earnings accrued to them after they have withdrawn their staked SPA tokens.

## Auto-Cooldown

When new users start staking, the auto-cooldown feature is applied. Auto-cooldown means that the veSPA balance decays to zero linearly and the stakers are able to withdraw their staked SPA balance at the end of their lockup period.

## Stay Staked at Residual Value

Currently, this option is not available. If a user has chosen this option while staking in the past, their final veSPA balance was set at the residual veSPA balance. They would continue to earn all the staking rewards at this veSPA balance for as long as the protocol keeps distributing rewards. The residual veSPA balance is equivalent to the veSPA balance of a staking position that unlocks in 7 days.&#x20;

Residual veSPA balance = (7/365)\*Staked SPA tokens = 0.01917\*Staked SPA tokens

### Initiate Cooldown

Stakers can initiate cooldown when 7 days are left in lockup expiry or anytime after that. When the staker’s veSPA balance is set to the residual veSPA balance or when only 7 days are left in the lockup period, the staker can initiate a transaction to start a cooldown period. When the cooldown period is initiated the lockup expiry date is updated to a new date which would be 7 days from the date on which the cooldown was initiated.&#x20;

Staker’s veSPA balance decays from the residual veSPA balance to zero during the cooldown period. At the end of the cooldown period, the staker can withdraw the SPA they had deposited. Stakers receive rewards during the cooldown period in proportion to their veSPA balance.&#x20;

At the end of the cooldown period, the veSPA balance remains zero and the user doesn’t get any rewards. The users can unstake at any point in time after the cooldown period has ended.&#x20;

<details>

<summary>Example</summary>

**On Day 0,** user staked 1000 SPA for 365 days. Their veSPA balance will be 1000 veSPA&#x20;

**On the 358th day** the user’s veSPA balance will be \~ 19.17 (1000x(7/365)). At this point of time, the user can initiate a cooldown period.&#x20;

**On the 365th day**, if the user hasn’t yet initiated a cooldown period the user’s veSPA balance will be \~ 19.17. At this point the lockup has expired and the user can initiate a cooldown period.&#x20;

**On the 400th day**, if the user hasn’t yet initiated a cooldown period the user’s veSPA balance will be \~ 19.17 and they can initiate a cooldown period. After the end of the cooldown period the user can unstake the 1000 SPA tokens.&#x20;

Let’s say on the 400th day the user initiates a cooldown, they would be able to withdraw the tokens on the 407th day.

</details>

##


# Staking Rewards

veSPA holders or stakers get SPA token rewards in proportion to their veSPA balance. Users have an option to stake their SPA rewards directly into the staking protocol instead of claiming, thereby compounding their veSPA balances.

veSPA holders or stakers will receive 2 kinds of rewards. Both kinds of rewards are distributed with the same mechanism and in the form of SPA tokens:

1. 100% of the USDs Fees generated by USDs protocol.
2. Incentives sponsored by Treasury to bootstrap the Staking protocol - This emission has been set to 0 through governance.

#### **1. USDs Fee Rewards**

The USDs protocol fees collected will be distributed across all veSPA holders on a pro rata basis. With the fees collected by the USDs protocol the Staking protocol will purchase SPA tokens from the market and distribute the SPA tokens amongst all veSPA holders.

#### **2. Incentive Rewards**

A separate SPA reward budget was set aside from Treasury to bootstrap staking protocol. Incentive rewards for staking were initially set at a fixed daily distribution number of 54.794 K SPA. This number was later changed through governance and set to 0 to reduce SPA inflation, and xSPA rewards have been increased to 420,000 per week as per [SIP-66](https://snapshot.box/#/s:speraxdao.eth/proposal/0x401841b87ef3b503e8732eaace2b867faab15b91383e94bad9c90ec61e2540cd).

The yield and fee income are swapped for SPA tokens before distribution. The SPA that is bought back from the open markets using 30% (SIP-66) of the auto-yield and 100% of the fees is stored in: [0xA61a0719e9714c95345e89a2f1C83Fae6f5745ef](https://arbiscan.io/address/0xA61a0719e9714c95345e89a2f1C83Fae6f5745ef#tokentxns) (Arbitrum One).

### **Distribution of Staking Rewards**

Staking reward distribution happens on a weekly basis. New weeks start on Thursdays at 00:00:00 UTC. Rewards are distributed at the end of each week.

‘Stake-Reward-Claim-Repeat’ is a four-step cycle:

1. Stake SPA - In Week 1, you stake SPA and obtain veSPA. Reward accumulation starts from Week 2.
2. Reward distribution for Week 2 occurs at the end of the Week 2
   * Total staking reward available for distribution in Week 2 is based on USDs fee income that was collected, the yield that was generated by the USDs protocol and the daily distribution rate of the SPA staking incentives for Week 2
   * User’s share of staking rewards for Week 2 is calculated based on their veSPA balance at the starting of Week 2 relative to the total veSPA supply at the starting of week 2
3. Rewards for Week 2 can be claimed by users from Week 3 onwards. Users can also stake their SPA rewards and increase their veSPA balance and future rewards.
4. Step 2 and 3 repeat every week till expiry
   * Reward distribution for Week X occurs at the end of the Week X
   * Rewards for Week X can be claimed by users from Week X+1 onwards.

## **Calculation of** Staking Rewards

**Total SPA Rewards for the week = Staking Incentive Rewards + USDs Fees Rewards + USDs Yield Share Rewards**

where Staking Incentive Rewards = Daily Incentive Rewards\*7

&#x20;                     USDs Fees Rewards =  USDs Fee earned\*USDs Price / SPA price &#x20;

&#x20;          USDs Yield Share Rewards = 50%\*USDs yield earned in the week \* USDs price/ SPA price&#x20;

The above formula is an assumption, actual SPA rewards from USDs fees and yield would differ based on the asset prices in the open market

Total SPA Rewards for the week = R

Total veSPA balance of the protocol at the start of the week = V

User’s veSPA balance at the start of the week = v

User’s SPA staked at the start of the week = s

User's staking duration in years = d = v/s

Weekly Reward Earned by a user = r = (R/V)\*v

**Staking APR**&#x20;

**= (Weekly Reward Earned by a user /SPA staked by user)\*(365/7)\*100%**

**= (r/s)\*(365/7)\*100%**

**= (R/V)\*(v/s)\*(365/7)\*100%**

&#x20;**= (R/V)\*d \*(365/7)\*100%**

**Staking APY**&#x20;

&#x20;**= \[{1+ (Weekly Reward Earned by a user /SPA staked by user)}^(365/7) -1] \* 100%**&#x20;

&#x20;**= \[{1+ (r/s)}^(365/7) -1] \* 100%**&#x20;

**= \[{1+ (R/V)\*(v/s)}^(365/7) -1] \* 100%**

&#x20;**= \[{1+ (R/V)\*d}^(365/7) -1] \* 100%**

Calculation of APY assumes that the weekly rewards are re-staked in the protocol.<br>


# Sperax Farms Protocol

Works on Arbitrum Uniswap V2, Uniswap V3, Camelot V2, Camelot V3 and Balancer V2.

[Sperax Farms](https://app.sperax.io/farms) protocol is a protocol for DAOs to launch and manage decentralized exchange liquidity - without needing to know how to code. Sperax Farms give users the power to launch incentivized liquidity pools on Uniswap V3 and Camelot V2. Future versions will support custom liquidity shapes on major DEXs such as Balancer, Sushiswap or anything veSPA holders prefer. Sperax Farms is launched on Arbitrum and will be expanded to Optimism, Polygon and Ethereum soon. Additional blockchains will be added in future versions.

Sperax Farms automates the fundamental aspects of launching and managing decentralized exchange liquidity for the DAOs native token:

* **Engineering support to launch and manage the farm** - The Audited Farm Factory contract will generate the pool and farm contracts for the Sperax Farms user.
* **Marketing support to make the community aware of the new farm** - Protocols that launch their farm through Sperax Farms benefit from being whitelisted on the Sperax Farms active farms dashboard. This exclusive list features all of the farms that are actively distributing rewards that were deployed with Sperax Farms. Farmers will regularly look to this dashboard for new projects and become users of these protocols.

On Arbitrum, Uniswap has less liquidity than Balancer and Sushiswap. This is because Sushiswap uses the simple Uniswap V2, x\*y=k approach. This is simple because all LP tokens are the same but penalizes the LP because they are forced to provide liquidity from 0 to infinity. Incentivized liquidity pools on Uniswap V3 lets DAOs benefit from concentrated liquidity - the same TVL offers less slippage compared to diluted liquidity. This directly translates to a lower emissions budget for other protocols and much more fees for LPs.

To launch a Uniswap V3 or Camelot V3 farm, DAOs are currently expected to write complicated V3 farm contracts, get the contracts audited, incentivize LP deposits with only their native token, then promote this new pool. With Sperax Farms, DAOs can launch these farms without knowing how to code and get marketing and technical support from Sperax.

DAOs can also launch their farms on Camelot V2, their farms can get rewards both in SPA and Camelot tokens (xGRAIL/GRAIL) that decrease DAO's token spend and decrease sale pressure on it.

#### **Sperax Farms V2**

In Sperax Farms Protocol V2, we have focused more on the protocol's multichain vision and to support that, we have discontinued incentives on pairing with SPA and USDs as these tokens are not available on all the chains. Now the fee params are configurable in the farm registry contract. More details are shared in the next section.


# How does Sperax Farms work?

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2F73MibEft2MttiXbacj3m%2FChange%20Demeter%20to%20Farms%20(1).png?alt=media&#x26;token=a096f354-a3e9-453c-ba3b-d7bd1f217536" alt=""><figcaption></figcaption></figure>

**Overview**

Sperax Farms is a protocol that enables DAOs to launch and manage decentralized exchange (DEX) liquidity pools and farms on platforms like Uniswap V2, Uniswap V3, Camelot V2, Camelot V3 and Balancer V2. The protocol simplifies the process of incentivizing liquidity for the DAOs' native tokens without requiring coding expertise. Sperax Farms automates the creation, management, and reward distribution for liquidity pools, providing support in engineering, marketing, and financial incentives.

#### **Launching Farm on Sperax Farms (For Farm Admins)**

#### **Steps to Launch a Farm**

1. **Approve Fees Spend**: Users must first approve the spending of the fee token for the farm creation fee. The fee is 100 USDs on Arbitrum. On any chain not supporting USDs, it can be any other stable coin supported on that chain.
2. **Input Pool and Farm Parameters**: Users must provide necessary parameters for the pool and farm.
3. **Execute Transaction**: A transaction is executed to create the farm and pay the farm creation fee.
   * **Reversion Conditions**:
     * If the pool does not exist, the transaction reverts.
     * If the user does not have enough fee tokens to pay the fee, the transaction reverts.

#### **Pool Parameters**

1. **Token address**
   * Token A
   * Token B
2. **Fee Tier (for Uniswap V3 Pools)**
3. **Liquidity Parameter L** - An LP token parameter which is set based on the user’s liquidity inside the pool. Updating this parameter will allow the farm users to add or remove liquidity. When the LP token is updated, the LP token should start receiving rewards based on the new L parameter. This will allow users to add or remove liquidity without having to unstake their entire LP position.
4. **Active Liquidity Time Check -** (a Boolean value of true or false which determines whether the position is in the current price range) - To check if the position is in the current price range, as only that liquidity will be rewarded which is in range. However, users will be allowed to remove any locked liquidity during the period when the liquidity is not in the current price range.

#### **Base Farm Parameters**

1. **Farm admin:** It is the address that will have admin control on the farm. It can be the same as the deployer’s address or any other desired address which will be used to manage the farm.
2. **Price range for the LP**
3. **Reward tokens**
   * Token addresses
   * Token address managers: Each token will have its own token manager.
   * Reward tokens have to be added at the time of farm creation and can't be added or removed after the farm is created. Maximum 4 reward tokens are possible for a farm.
   * For reward tokens emitting fixed APR, Token manager will be the Rewarder contract deployed through the Rewarder factory.
4. **Cooldown Period for Locked Liquidity** - It is the number of days users have to wait after initiating cooldown before they can unstake from a locked position. Only whole numbers are allowed for this parameter.
   * If Cooldown Period = 0, then the farm only allows creation of unlocked positions. Unlocked positions can be unstaked anytime.
   * If Cooldown Period > =1, the farm will allow creation of both locked and unlocked positions. For unstaking a locked position, users have to initiate cooldown and wait for cooldown period before unstaking.
5. **Start date time stamp** - Reward emission starts from this date. This date can be changed by the farm admin using admin functions (updateFarmStartTime). However, date change is not allowed after the farm starts.
   * The farms start accepting liquidity immediately after the creation of the farm contract. However, the reward accrual starts from the farm start date time stamp.
6. **Annual Percentage Return APR** - The farm admin can set a fixed APR which will guarantee a reward to the LPs based on the current price of the reward tokens. The farm admin will also have to choose one or more base tokens out of the tokens present in the farm for calculation of the daily number of reward tokens emitted.
   * Let’s say APR set = APR%.
   * Total value of Base Tokens in USD = Σ (Number of Base tokens in farm x USD value of Base Token)
   * No. of Reward tokens per day = \[(APR x Total value of Base Tokens in USD) / (100 x 365)] / (Price of 1 reward token based on the oracle)]
7. **Maximum number of Rewards Tokens Emitted Per Day** - The farm admin would be able to add the maximum number of reward tokens per day that the farm can distribute, to prevent any deficiency in the farm’s reward tokens in cases when many LPs deposit on the same day since then all the withdrawals may also happen on the same day.
   * It will override the reward tokens value calculated using the formula mentioned above in point no 6. The rewards emitted per day will be the minimum of the amount calculated above or the max reward rate set by the reward manager.

#### **Expirable Farm Parameters**

This is a new feature which has all the above parameters along with the expiry date feature:

1. **Expiry Date** - Farms will have an expiry date associated with them. Users can specify the expiry date while creating the farms. The initial launch fee of 100 USDs (or some other stable coin if USDs is not present on that chain) will add 100 days to the farm expiry. After that users have the option to extend the farm expiry date. Post that users will have to extend the farm in the multiple of 1 USDs/day with minimum of 100 days at a time and a maximum of 300 days.
   * Farm admins will not be able to update any farm parameters once the farm has expired. However, they can remove any unclaimed reward tokens from the contract.
   * Farm users can still claim any accrued rewards from the farm or remove liquidity from them once that farm has expired.
   * Farms that have expired will be available on the Dashboard for removing liquidity up to 30 days beyond expiry. After that the farms will only appear on the expired farm list and admins cannot make the expired farms active again. Users or admins will be able to apply all actions through the smart contract.
   * Expired farms shall be removed from the Sperax Gauge and would not be eligible for SPA rewards.
   * Farm does not accrue rewards after the expiration so users can call updateFarmRewardData function on the farm to accrue rewards before farmEndTime to avoid any loss of rewards.

#### **Fee**

* Sperax Farms will charge a flat $100 fee to launch the farm, which will add 100 days to the expiry date set while the creation of the farm.
* After that users have the option to extend the farm expiry date. They can do so in the multiple of 1 USDs/day with minimum of 100 days at a time and a maximum of 300 days. The fees can be paid in either USDs or in any other stable coin provided USDs is not present in that chain.
* The fee collected belongs to the SPA stakers and can be transferred directly to the wallet address where all Sperax protocol fees are collected. Fee amount can be changed in future through governance.
* The Fee details can be fetched from getFeeParams function on the Farm registry contract.

#### **Farm Management**

No one can make changes to the farm contract once deployed. Farm admins can do the following:

1. **Transfer farm ownership to another address**
2. **Change start date of the farm** - Farm will emit rewards from this date. The date can be changed after farm creation. However, date change is not allowed after the farm starts.
3. **Update cooldown period of the locked positions**
4. **Pause or Unpause the farm**
   * Pause the farm - All reward distributions are paused, LPs do not earn any rewards during this period. Withdrawals are allowed (including lockup LPs) and users can also claim previously accrued rewards. Admin/managers can make changes to the distribution rates and the other parameters when the farm is paused.
   * Unpause the farm - Resume the reward distribution. The reward distribution rate remains the same as set by the reward managers.
5. **Update Expiry Date of the Farm by paying Subscription Fees**
   * Farm admins can choose and update the expiry date of farms as mentioned in the Farm Parameters.
6. **Close the farm** - The farms can be closed before the expiry date and will automatically get closed once the expiry date is reached. Once the farm is closed, all liquidity providers including lockup users can now unstake their liquidity pool tokens and claim the accrued rewards from the farm.

#### **Reward Management**

Each reward token will be assigned a reward token manager. Farm admin cannot update the reward token manager once the farms are deployed. Reward token managers can do the following:

1. **Add reward token balance**
2. **Update reward distribution rate per second for each token**. Only future distribution rates can be affected through this. Reward distribution can be paused by setting the rate to 0. These actions can be done:
   1. For all liquidity providers.
   2. For lockup liquidity providers (If cooldown period is greater than 0)
3. **Changing the maximum number of token rewards per day** - Farm admins can increase or decrease the reward tokens limit in the fixed APR model as per their choice.
4. **Withdraw reward tokens** (Any rewards already accrued to LPs cannot be removed).
5. **Transfer reward token management to another address.**

#### **Setting up a Farm Position (For Liquidity Providers/Retail Users)**

#### **Adding a Farm Position:**

1. **Select the farm:** LPs need to choose the required farm from the whitelisted farms which are present on the dashboard, based on their choice of tokens and price range.
2. **Enter the number of farm tokens:** Post that, they can enter the number of one of the tokens for the position, the other tokens are automatically calculated.
3. **Execute Transaction:** The user then needs to approve the wallet transactions for the spending of tokens and creation of a farm position.
   * **Reversion Conditions:**
     * If the user does not have the required tokens in their wallet, the transaction revert**s.**
4. **LP Token:** On successful execution of the transaction, the Liquidity Provider will receive the LP token(s) in their wallet.
5. **Depositing the LP Token:** Users then need to deposit the lp tokens inside the farm to create a position.

#### **Updating Liquidity in the LP Tokens:**

1. **Updating the Liquidity Balance** - This will allow LPs to add to or remove liquidity from the LP Token without having to unstake their entire LP position. When the LP token is updated, the LP token should start receiving rewards based on the new L parameter.

#### **Rewards Emission:**

1. **Fixed APR Rewards** - The LPs will receive fixed APR rewards (this fixed APR will be set by the farm admin) generated from their invested farms. Each farm will have some base reward tokens which will be the base for calculating the number of reward tokens to be emitted per day. The LP will receive the reward tokens (selected by the farm admin) in their wallet, which will be calculated as:
   * Let’s say APR set = APR%.
   * Total value of Base Tokens in USD = Σ (Number of Base tokens in farm x USD value of Base Token)
   * No. of Reward tokens per day = \[(APR x Total value of Base Tokens in USD) / (100 x 365)] / (Price of 1 reward token based on the oracle)]
2. **Maximum number of Rewards Tokens Emitted Per Day** - However, the number of reward tokens to be emitted by the farm has been capped. The farm admin would be able to add the maximum number of reward tokens per day that the farm can distribute, to prevent any deficiency in the farm’s reward tokens in cases when many LPs deposit on the same day since then all the withdrawals may also happen on the same day.


# Technical documents

This technical document is about the upgrade to Sperax Farms v2. It details the changes made to enhance the protocol's multi chain vision, transparency, security, and scalability. The document covers new features and functionalities.

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FiYqFTgjr5Nscc8KMUX8o%2FDemeterV2-Page-1.drawio%20(1).png?alt=media&#x26;token=226ddfba-78b9-4547-b45f-4c5c4d96660a" alt=""><figcaption><p>Sperax Farms protocol farm admin and user interaction diagram</p></figcaption></figure>

<figure><img src="https://1313079570-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MAO4g69-aVw4mnh3kXO%2Fuploads%2FWtwEvEcYFyKzvkzeRSU0%2FDemeterV2-Page-2.drawio.png?alt=media&#x26;token=b90e99b3-9424-4593-86ab-5d8e82da0907" alt=""><figcaption><p>FIxed APR rewarder flow</p></figcaption></figure>


# Smart contracts

High level documentation of smart contracts


# E721 Farms

E721 farms include all the farms built for pools in which the liquidity provider has an NFT (ERC721) position.


# E721Farm

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/e721-farms/E721Farm.sol)

**Inherits:** Farm, IERC721Receiver

**Author:** Sperax Foundation.

This contract contains the core logic for E721 farms.

## State Variables

### nftContract

```solidity
address public nftContract;
```

### depositToTokenId

```solidity
mapping(uint256 => uint256) public depositToTokenId;
```

## Functions

### onERC721Received

Function is called when user transfers the NFT to this farm.

```solidity
function onERC721Received(address, address _from, uint256 _tokenId, bytes calldata _data)
    external
    override
    returns (bytes4);
```

**Parameters**

| Name       | Type      | Description                                                   |
| ---------- | --------- | ------------------------------------------------------------- |
| `<none>`   | `address` |                                                               |
| `_from`    | `address` | The address of the owner.                                     |
| `_tokenId` | `uint256` | NFT Id generated by other protocol (e.g. Camelot or Uniswap). |
| `_data`    | `bytes`   | The data should be the lockup flag (bool).                    |

**Returns**

| Name     | Type     | Description                           |
| -------- | -------- | ------------------------------------- |
| `<none>` | `bytes4` | bytes4 The onERC721Received selector. |

### withdraw

Function to withdraw a deposit from the farm.

```solidity
function withdraw(uint256 _depositId) external override nonReentrant;
```

**Parameters**

| Name         | Type      | Description                            |
| ------------ | --------- | -------------------------------------- |
| `_depositId` | `uint256` | The id of the deposit to be withdrawn. |

### \_getLiquidity

Function to get the liquidity. Must be defined by the farm.

*This function should be overridden to add the respective logic.*

```solidity
function _getLiquidity(uint256 _tokenId) internal view virtual returns (uint256);
```

**Parameters**

| Name       | Type      | Description      |
| ---------- | --------- | ---------------- |
| `_tokenId` | `uint256` | The nft tokenId. |

**Returns**

| Name     | Type      | Description                        |
| -------- | --------- | ---------------------------------- |
| `<none>` | `uint256` | The liquidity of the nft position. |

## Errors

### UnauthorisedNFTContract

```solidity
error UnauthorisedNFTContract();
```

### NoData

```solidity
error NoData();
```


# Camelot V3

Pools in camelot V3 are very similar to Uniswap V3. When a liquidity provider supplies assets to the pool, the LP receives an NFT position in return.

Next, you can see the specification for Camelot V3 farm and Camelot V3 farm deployer.


# CamelotV3FarmDeployer

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/e721-farms/camelotV3/CamelotV3FarmDeployer.sol)

**Inherits:** FarmDeployer

**Author:** Sperax Foundation.

This contract allows anyone to calculate fees, pay fees and create farms.

## State Variables

### CAMELOT\_V3\_FACTORY

```solidity
address public immutable CAMELOT_V3_FACTORY;
```

### NFPM

```solidity
address public immutable NFPM;
```

### CAMELOT\_UTILS

```solidity
address public immutable CAMELOT_UTILS;
```

### CAMELOT\_NFPM\_UTILS

```solidity
address public immutable CAMELOT_NFPM_UTILS;
```

## Functions

### constructor

Constructor of the contract.

```solidity
constructor(
    address _farmRegistry,
    string memory _farmId,
    address _camelotV3Factory,
    address _nfpm,
    address _camelotUtils,
    address _nfpmUtils
) FarmDeployer(_farmRegistry, _farmId);
```

**Parameters**

| Name                | Type      | Description                                                                                       |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `_farmRegistry`     | `address` | Address of the Farm Registry.                                                                     |
| `_farmId`           | `string`  | Id of the farm.                                                                                   |
| `_camelotV3Factory` | `address` | Address of CamelotV3 factory.                                                                     |
| `_nfpm`             | `address` | Address of Camelot NonfungiblePositionManager contract.                                           |
| `_camelotUtils`     | `address` | Address of CamelotUtils (Camelot helper) contract.                                                |
| `_nfpmUtils`        | `address` | Address of Camelot INonfungiblePositionManagerUtils (NonfungiblePositionManager helper) contract. |

### createFarm

Deploys a new CamelotV3 farm.

*The caller of this function should approve feeAmount to this contract before calling this function.*

```solidity
function createFarm(FarmData memory _data) external nonReentrant returns (address);
```

**Parameters**

| Name    | Type       | Description          |
| ------- | ---------- | -------------------- |
| `_data` | `FarmData` | Data for deployment. |

**Returns**

| Name     | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| `<none>` | `address` | Address of the deployed farm. |

## Structs

### FarmData

```solidity
struct FarmData {
    address farmAdmin;
    uint256 farmStartTime;
    uint256 cooldownPeriod;
    CamelotPoolData camelotPoolData;
    RewardTokenData[] rewardData;
}
```


# CamelotV3Farm

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/e721-farms/camelotV3/CamelotV3Farm.sol)

**Inherits:** E721Farm, OperableDeposit, ClaimableFee

**Author:** Sperax Foundation.

This contract is the implementation of the Camelot V3 farm.

## State Variables

### tickLowerAllowed

```solidity
int24 public tickLowerAllowed;
```

### tickUpperAllowed

```solidity
int24 public tickUpperAllowed;
```

### camelotPool

```solidity
address public camelotPool;
```

### camelotV3Factory

```solidity
address public camelotV3Factory;
```

### camelotUtils

```solidity
address public camelotUtils;
```

### nfpmUtils

```solidity
address public nfpmUtils;
```

### MIN\_TICK

```solidity
int256 internal constant MIN_TICK = -887272;
```

### MAX\_TICK

```solidity
int256 internal constant MAX_TICK = 887272;
```

## Functions

### initialize

Initializer function of this farm.

```solidity
function initialize(InitializeInput calldata _input) external;
```

**Parameters**

| Name     | Type              | Description                           |
| -------- | ----------------- | ------------------------------------- |
| `_input` | `InitializeInput` | A struct having all the input params. |

### increaseDeposit

Allow user to increase liquidity for a deposit.

```solidity
function increaseDeposit(uint256 _depositId, uint256[2] calldata _amounts, uint256[2] calldata _minAmounts)
    external
    nonReentrant;
```

**Parameters**

| Name          | Type         | Description                                        |
| ------------- | ------------ | -------------------------------------------------- |
| `_depositId`  | `uint256`    | The id of the deposit to be increased.             |
| `_amounts`    | `uint256[2]` | Desired amount of tokens to be increased.          |
| `_minAmounts` | `uint256[2]` | Minimum amount of tokens to be added as liquidity. |

### decreaseDeposit

Withdraw liquidity partially from an existing deposit.

```solidity
function decreaseDeposit(uint256 _depositId, uint128 _liquidityToWithdraw, uint256[2] calldata _minAmounts)
    external
    nonReentrant;
```

**Parameters**

| Name                   | Type         | Description                              |
| ---------------------- | ------------ | ---------------------------------------- |
| `_depositId`           | `uint256`    | Deposit index for the user.              |
| `_liquidityToWithdraw` | `uint128`    | Amount to be withdrawn.                  |
| `_minAmounts`          | `uint256[2]` | Minimum amount of tokens to be received. |

### getTokenAmounts

Function to be called by Rewarder to get tokens and amounts associated with the farm's liquidity.

```solidity
function getTokenAmounts() external view override returns (address[] memory, uint256[] memory);
```

**Returns**

| Name     | Type        | Description                         |
| -------- | ----------- | ----------------------------------- |
| `<none>` | `address[]` | tokens An array of token addresses. |
| `<none>` | `uint256[]` | amounts An array of token amounts.  |

### \_claimPoolFee

Claim pool fee implementation from `ClaimableFee` feature.

```solidity
function _claimPoolFee(uint256 _depositId)
    internal
    override
    returns (uint256 tokenId, uint256 amt0Recv, uint256 amt1Recv);
```

**Parameters**

| Name         | Type      | Description                            |
| ------------ | --------- | -------------------------------------- |
| `_depositId` | `uint256` | Deposit ID of the deposit in the farm. |

### \_getLiquidity

Validate the position for the pool and get Liquidity.

*The position must adhere to the price ranges.*

*Only allow specific pool token to be staked.*

```solidity
function _getLiquidity(uint256 _tokenId) internal view override returns (uint256);
```

**Parameters**

| Name       | Type      | Description                  |
| ---------- | --------- | ---------------------------- |
| `_tokenId` | `uint256` | The tokenId of the position. |

**Returns**

| Name     | Type      | Description                    |
| -------- | --------- | ------------------------------ |
| `<none>` | `uint256` | The liquidity of the position. |

### \_validateTickRange

Validate the ticks (upper and lower).

*Get the info of the required token.*

*Check if the token belongs to correct pool.*

*Check if the token adheres to the tick range.*

*The ticks must be within the max range and must be multiple of tickSpacing.*

```solidity
function _validateTickRange(int24 _tickLower, int24 _tickUpper) private view;
```

**Parameters**

| Name         | Type    | Description                  |
| ------------ | ------- | ---------------------------- |
| `_tickLower` | `int24` | The lower tick of the range. |
| `_tickUpper` | `int24` | The upper tick of the range. |

## Errors

### InvalidCamelotPoolConfig

```solidity
error InvalidCamelotPoolConfig();
```

### IncorrectPoolToken

```solidity
error IncorrectPoolToken();
```

### IncorrectTickRange

```solidity
error IncorrectTickRange();
```

### InvalidTickRange

```solidity
error InvalidTickRange();
```

### InvalidAmount

```solidity
error InvalidAmount();
```


# Base contracts

These contracts are base for all the other contracts and they have the common logic for functionalities like deposit, withdraw, createFarm, etc.


# Farm

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/Farm.sol)

**Inherits:** FarmStorage, OwnableUpgradeable, ReentrancyGuardUpgradeable, MulticallUpgradeable

**Author:** Sperax Foundation.

This contract contains the core logic for the Sperax farms.

## Functions

### constructor

```solidity
constructor();
```

### withdraw

Function to be called to withdraw deposit.

```solidity
function withdraw(uint256 _depositId) external virtual;
```

**Parameters**

| Name         | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `_depositId` | `uint256` | The id of the deposit. |

### claimRewards

A function to be called by the depositor to claim rewards.

```solidity
function claimRewards(uint256 _depositId) external;
```

**Parameters**

| Name         | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `_depositId` | `uint256` | The id of the deposit. |

### initiateCooldown

Function to be called to initiate cooldown for a staked deposit.

*\_depositId is corresponding to the user's deposit.*

```solidity
function initiateCooldown(uint256 _depositId) external nonReentrant;
```

**Parameters**

| Name         | Type      | Description                         |
| ------------ | --------- | ----------------------------------- |
| `_depositId` | `uint256` | The id of the deposit to be locked. |

### addRewards

Add rewards to the farm.

```solidity
function addRewards(address _rwdToken, uint256 _amount) external nonReentrant;
```

**Parameters**

| Name        | Type      | Description                         |
| ----------- | --------- | ----------------------------------- |
| `_rwdToken` | `address` | The reward token's address.         |
| `_amount`   | `uint256` | The amount of reward tokens to add. |

### updateCooldownPeriod

Update the cooldown period.

```solidity
function updateCooldownPeriod(uint256 _newCooldownPeriod) external onlyOwner;
```

**Parameters**

| Name                 | Type      | Description                                             |
| -------------------- | --------- | ------------------------------------------------------- |
| `_newCooldownPeriod` | `uint256` | The new cooldown period (in days). E.g: 7 means 7 days. |

### farmPauseSwitch

Pause / UnPause the farm.

```solidity
function farmPauseSwitch(bool _isPaused) external onlyOwner;
```

**Parameters**

| Name        | Type   | Description                                         |
| ----------- | ------ | --------------------------------------------------- |
| `_isPaused` | `bool` | Desired state of the farm (true to pause the farm). |

### closeFarm

A function to explicitly close the farm.

*Recovers remaining non accrued rewards.*

```solidity
function closeFarm() external onlyOwner nonReentrant;
```

### recoverERC20

Recover erc20 tokens other than the reward tokens.

```solidity
function recoverERC20(address _token) external onlyOwner nonReentrant;
```

**Parameters**

| Name     | Type      | Description                       |
| -------- | --------- | --------------------------------- |
| `_token` | `address` | Address of token to be recovered. |

### recoverRewardFunds

Get the remaining reward balance out of the farm.

*Function recovers minOf(\_amount, rewardsLeft).*

```solidity
function recoverRewardFunds(address _rwdToken, uint256 _amount) external nonReentrant;
```

**Parameters**

| Name        | Type      | Description                                      |
| ----------- | --------- | ------------------------------------------------ |
| `_rwdToken` | `address` | The reward token's address.                      |
| `_amount`   | `uint256` | The amount of the reward tokens to be withdrawn. |

### setRewardRate

Function to update reward params for a fund.

```solidity
function setRewardRate(address _rwdToken, uint128[] memory _newRewardRates) external;
```

**Parameters**

| Name              | Type        | Description                                                |
| ----------------- | ----------- | ---------------------------------------------------------- |
| `_rwdToken`       | `address`   | The reward token's address.                                |
| `_newRewardRates` | `uint128[]` | The new reward rate for the fund (includes the precision). |

### updateRewardData

Transfer the tokenManagerRole to other user.

*Only the existing tokenManager for a reward can call this function.*

```solidity
function updateRewardData(address _rwdToken, address _newTknManager) external;
```

**Parameters**

| Name             | Type      | Description                       |
| ---------------- | --------- | --------------------------------- |
| `_rwdToken`      | `address` | The reward token's address.       |
| `_newTknManager` | `address` | Address of the new token manager. |

### computeRewards

Function to compute the total accrued rewards for a deposit for each subscription.

```solidity
function computeRewards(address _account, uint256 _depositId)
    external
    view
    virtual
    returns (uint256[][] memory rewards);
```

**Parameters**

| Name         | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `_account`   | `address` | The user's address.    |
| `_depositId` | `uint256` | The id of the deposit. |

**Returns**

| Name      | Type          | Description                                                                      |
| --------- | ------------- | -------------------------------------------------------------------------------- |
| `rewards` | `uint256[][]` | The total accrued rewards for the deposit for each subscription (uint256\[]\[]). |

### getRewardFunds

Get the reward fund details.

```solidity
function getRewardFunds() external view returns (RewardFund[] memory);
```

**Returns**

| Name     | Type           | Description                                                   |
| -------- | -------------- | ------------------------------------------------------------- |
| `<none>` | `RewardFund[]` | The available reward funds' details for all the reward funds. |

### getRewardData

Get the reward details for specified reward token.

```solidity
function getRewardData(address _rwdToken) external view returns (RewardData memory);
```

**Parameters**

| Name        | Type      | Description                      |
| ----------- | --------- | -------------------------------- |
| `_rwdToken` | `address` | The address of the reward token. |

**Returns**

| Name     | Type         | Description                                                  |
| -------- | ------------ | ------------------------------------------------------------ |
| `<none>` | `RewardData` | The available reward details for the specified reward token. |

### getDepositInfo

Get deposit info for a deposit id.

```solidity
function getDepositInfo(uint256 _depositId) external view returns (Deposit memory);
```

**Parameters**

| Name         | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `_depositId` | `uint256` | The id of the deposit. |

**Returns**

| Name     | Type      | Description                 |
| -------- | --------- | --------------------------- |
| `<none>` | `Deposit` | The deposit info (Deposit). |

### getNumSubscriptions

Get number of subscriptions for an account.

```solidity
function getNumSubscriptions(uint256 _depositId) external view returns (uint256);
```

**Parameters**

| Name         | Type      | Description     |
| ------------ | --------- | --------------- |
| `_depositId` | `uint256` | The deposit id. |

**Returns**

| Name     | Type      | Description                                  |
| -------- | --------- | -------------------------------------------- |
| `<none>` | `uint256` | The number of subscriptions for the deposit. |

### getSubscriptionInfo

Get subscription stats for a deposit.

```solidity
function getSubscriptionInfo(uint256 _depositId, uint256 _subscriptionId) external view returns (Subscription memory);
```

**Parameters**

| Name              | Type      | Description            |
| ----------------- | --------- | ---------------------- |
| `_depositId`      | `uint256` | The deposit id.        |
| `_subscriptionId` | `uint256` | The subscription's id. |

**Returns**

| Name     | Type           | Description                           |
| -------- | -------------- | ------------------------------------- |
| `<none>` | `Subscription` | The subscription info (Subscription). |

### getRewardRates

Get reward rates for a rewardToken.

```solidity
function getRewardRates(address _rwdToken) external view returns (uint256[] memory);
```

**Parameters**

| Name        | Type      | Description                 |
| ----------- | --------- | --------------------------- |
| `_rwdToken` | `address` | The reward token's address. |

**Returns**

| Name     | Type        | Description                                         |
| -------- | ----------- | --------------------------------------------------- |
| `<none>` | `uint256[]` | The reward rates for the reward token (uint256\[]). |

### getRewardFundInfo

Get farm reward fund info.

```solidity
function getRewardFundInfo(uint8 _fundId) external view returns (RewardFund memory);
```

**Parameters**

| Name      | Type    | Description    |
| --------- | ------- | -------------- |
| `_fundId` | `uint8` | The fund's id. |

**Returns**

| Name     | Type         | Description                        |
| -------- | ------------ | ---------------------------------- |
| `<none>` | `RewardFund` | The reward fund info (RewardFund). |

### getRewardTokens

Function to get the reward tokens added in the farm.

```solidity
function getRewardTokens() external view returns (address[] memory);
```

**Returns**

| Name     | Type        | Description                          |
| -------- | ----------- | ------------------------------------ |
| `<none>` | `address[]` | The reward tokens added in the farm. |

### getTokenAmounts

Function to be called by Rewarder to get tokens and amounts associated with the farm's liquidity.

*This function should be overridden to add the respective logic.*

```solidity
function getTokenAmounts() external view virtual returns (address[] memory, uint256[] memory);
```

**Returns**

| Name     | Type        | Description                                   |
| -------- | ----------- | --------------------------------------------- |
| `<none>` | `address[]` | Tokens associated with the farm's pool.       |
| `<none>` | `uint256[]` | Amounts associated with the farm's liquidity. |

### updateFarmRewardData

Function to update the FarmRewardData for all funds.

```solidity
function updateFarmRewardData() public virtual;
```

### claimRewardsTo

Claim rewards and send it to another account.

*Only the depositor can call this function.*

```solidity
function claimRewardsTo(address _account, uint256 _depositId) public nonReentrant;
```

**Parameters**

| Name         | Type      | Description             |
| ------------ | --------- | ----------------------- |
| `_account`   | `address` | To receive the rewards. |
| `_depositId` | `uint256` | The id of the deposit.  |

### updateFarmStartTime

Update the farm start time.

*Can be updated only before the farm start. New start time should be in future.*

```solidity
function updateFarmStartTime(uint256 _newStartTime) public virtual onlyOwner;
```

**Parameters**

| Name            | Type      | Description              |
| --------------- | --------- | ------------------------ |
| `_newStartTime` | `uint256` | The new farm start time. |

### isFarmOpen

Returns if farm is open. Farm is open if it is not closed.

*This function can be overridden to add any new/additional logic.*

```solidity
function isFarmOpen() public view virtual returns (bool);
```

**Returns**

| Name     | Type   | Description                |
| -------- | ------ | -------------------------- |
| `<none>` | `bool` | bool True if farm is open. |

### isFarmActive

Returns if farm is active. Farm is active if it is not paused and not closed.

*This function can be overridden to add any new/additional logic.*

```solidity
function isFarmActive() public view virtual returns (bool);
```

**Returns**

| Name     | Type   | Description                  |
| -------- | ------ | ---------------------------- |
| `<none>` | `bool` | bool True if farm is active. |

### getRewardBalance

Get the reward balance for specified reward token.

*This function calculates the available reward balance by considering the accrued rewards and the token supply.*

```solidity
function getRewardBalance(address _rwdToken) public view returns (uint256);
```

**Parameters**

| Name        | Type      | Description                      |
| ----------- | --------- | -------------------------------- |
| `_rwdToken` | `address` | The address of the reward token. |

**Returns**

| Name     | Type      | Description                                                  |
| -------- | --------- | ------------------------------------------------------------ |
| `<none>` | `uint256` | The available reward balance for the specified reward token. |

### \_recoverERC20

```solidity
function _recoverERC20(address _token) internal virtual;
```

### \_deposit

Common logic for deposit in the farm.

```solidity
function _deposit(address _account, bool _lockup, uint256 _liquidity) internal returns (uint256);
```

**Parameters**

| Name         | Type      | Description                               |
| ------------ | --------- | ----------------------------------------- |
| `_account`   | `address` | Address of the depositor.                 |
| `_lockup`    | `bool`    | Lockup option for the deposit.            |
| `_liquidity` | `uint256` | Liquidity amount to be added to the pool. |

**Returns**

| Name     | Type      | Description     |
| -------- | --------- | --------------- |
| `<none>` | `uint256` | The deposit id. |

### \_initiateCooldown

Common logic for initiating cooldown.

```solidity
function _initiateCooldown(uint256 _depositId) internal;
```

**Parameters**

| Name         | Type      | Description        |
| ------------ | --------- | ------------------ |
| `_depositId` | `uint256` | User's deposit Id. |

### \_withdraw

Common logic for withdraw.

```solidity
function _withdraw(uint256 _depositId) internal;
```

**Parameters**

| Name         | Type      | Description        |
| ------------ | --------- | ------------------ |
| `_depositId` | `uint256` | User's deposit id. |

### \_updateAndClaimFarmRewards

Claim rewards for the user.

*NOTE: any function calling this private function should be marked as non-reentrant.*

```solidity
function _updateAndClaimFarmRewards(uint256 _depositId) internal;
```

**Parameters**

| Name         | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `_depositId` | `uint256` | The id of the deposit. |

### \_updateAndClaimFarmRewardsTo

Claim rewards for the user and send it to another account.

*NOTE: any function calling this private function should be marked as non-reentrant.*

```solidity
function _updateAndClaimFarmRewardsTo(uint256 _depositId, address _receiver) internal;
```

**Parameters**

| Name         | Type      | Description                                                     |
| ------------ | --------- | --------------------------------------------------------------- |
| `_depositId` | `uint256` | The id of the deposit.                                          |
| `_receiver`  | `address` | The receiver of the rewards (Could be different from depositor) |

### \_recoverRewardFunds

Get the remaining reward balance out of the farm.

*Function recovers minOf(\_amount, rewardsLeft).*

*In case of partial withdraw of funds, the reward rate has to be set manually again.*

```solidity
function _recoverRewardFunds(address _rwdToken, uint256 _amount) internal;
```

**Parameters**

| Name        | Type      | Description                                     |
| ----------- | --------- | ----------------------------------------------- |
| `_rwdToken` | `address` | The reward token's address.                     |
| `_amount`   | `uint256` | The amount of the reward token to be withdrawn. |

### \_setRewardRate

Function to update reward params for a fund.

```solidity
function _setRewardRate(address _rwdToken, uint128[] memory _newRewardRates) internal;
```

**Parameters**

| Name              | Type        | Description                                                |
| ----------------- | ----------- | ---------------------------------------------------------- |
| `_rwdToken`       | `address`   | The reward token's address.                                |
| `_newRewardRates` | `uint128[]` | The new reward rate for the fund (includes the precision). |

### \_setupFarm

Function to setup the reward funds and initialize the farm global params during construction.

```solidity
function _setupFarm(
    string calldata _farmId,
    uint256 _farmStartTime,
    uint256 _cooldownPeriod,
    RewardTokenData[] memory _rwdTokenData
) internal initializer;
```

**Parameters**

| Name              | Type                | Description                                                         |
| ----------------- | ------------------- | ------------------------------------------------------------------- |
| `_farmId`         | `string`            | ID of the farm. E.g: `Demeter_Camelot_V2`.                          |
| `_farmStartTime`  | `uint256`           | - Farm start time.                                                  |
| `_cooldownPeriod` | `uint256`           | - Cooldown period in days for locked deposits. E.g: 7 means 7 days. |
| `_rwdTokenData`   | `RewardTokenData[]` | - Reward data for each reward token.                                |

### \_addRewardData

Adds new reward token to the farm.

```solidity
function _addRewardData(address _token, address _tknManager) internal;
```

**Parameters**

| Name          | Type      | Description                              |
| ------------- | --------- | ---------------------------------------- |
| `_token`      | `address` | Address of the reward token to be added. |
| `_tknManager` | `address` | Address of the reward token Manager.     |

### \_updateLastRewardAccrualTime

Update the last reward accrual time.

```solidity
function _updateLastRewardAccrualTime() internal virtual;
```

### \_getAccRewards

Computes the accrued reward for a given fund id and time interval.

*`_alreadyAccRewardBal` is useful when this function called from `computeRewards` function. As `computeReward` is a view function and it doesn't update the `accRewardBal` in the `rewardData`.*

```solidity
function _getAccRewards(uint8 _rwdId, uint8 _fundId, uint256 _time, uint256 _alreadyAccRewardBal)
    internal
    view
    returns (uint256);
```

**Parameters**

| Name                   | Type      | Description                               |
| ---------------------- | --------- | ----------------------------------------- |
| `_rwdId`               | `uint8`   | Id of the reward token.                   |
| `_fundId`              | `uint8`   | Id of the reward fund.                    |
| `_time`                | `uint256` | Time interval for the reward computation. |
| `_alreadyAccRewardBal` | `uint256` | Already accrued reward balance.           |

**Returns**

| Name     | Type      | Description                                                               |
| -------- | --------- | ------------------------------------------------------------------------- |
| `<none>` | `uint256` | accRewards Accrued rewards for the given `_rwdId`, `_fundId` and `_time`. |

### \_validateDeposit

Validate the deposit for account.

```solidity
function _validateDeposit(address _account, uint256 _depositId) internal view;
```

**Parameters**

| Name         | Type      | Description                                            |
| ------------ | --------- | ------------------------------------------------------ |
| `_account`   | `address` | Address of the caller to be checked against depositor. |
| `_depositId` | `uint256` | Id of the deposit.                                     |

### \_validateNotRecentDeposit

A function to validate deposit ts to prevent flash loan vulnerabilities

*Reverts when deposit made in the same transaction.*

```solidity
function _validateNotRecentDeposit(uint256 _depositTs) internal view;
```

**Parameters**

| Name         | Type      | Description                                                                   |
| ------------ | --------- | ----------------------------------------------------------------------------- |
| `_depositTs` | `uint256` | depositTs of user's deposit. (It represents deposit ts or increaseDeposit ts) |

### \_validateFarmOpen

Validate if farm is open. Revert otherwise.

*This function can be overridden to add any new/additional logic.*

```solidity
function _validateFarmOpen() internal view;
```

### \_validateFarmActive

Validate if farm is active. Revert otherwise. Farm is active if it is not paused and not closed.

*This function can be overridden to add any new/additional logic.*

```solidity
function _validateFarmActive() internal view;
```

### \_validateTokenManager

Validate the caller is the token Manager. Revert otherwise.

```solidity
function _validateTokenManager(address _rwdToken) internal view;
```

**Parameters**

| Name        | Type      | Description              |
| ----------- | --------- | ------------------------ |
| `_rwdToken` | `address` | Address of reward token. |

### \_validateRewardToken

Validate the reward token is valid.

```solidity
function _validateRewardToken(address _rwdToken) internal view;
```

**Parameters**

| Name        | Type      | Description              |
| ----------- | --------- | ------------------------ |
| `_rwdToken` | `address` | Address of reward token. |

### \_getRewardAccrualTimeElapsed

Get the time elapsed since the last reward accrual.

```solidity
function _getRewardAccrualTimeElapsed() internal view virtual returns (uint256);
```

**Returns**

| Name     | Type      | Description                                          |
| -------- | --------- | ---------------------------------------------------- |
| `<none>` | `uint256` | time The time elapsed since the last reward accrual. |

### \_validateCooldownPeriod

An internal function to validate cooldown period.

```solidity
function _validateCooldownPeriod(uint256 _cooldownPeriod) internal pure;
```

**Parameters**

| Name              | Type      | Description             |
| ----------------- | --------- | ----------------------- |
| `_cooldownPeriod` | `uint256` | Period to be validated. |

### \_validateNonZeroAddr

Validate address.

```solidity
function _validateNonZeroAddr(address _addr) internal pure;
```

**Parameters**

| Name    | Type      | Description              |
| ------- | --------- | ------------------------ |
| `_addr` | `address` | Address to be validated. |

### \_subscribeRewardFund

Add subscription to the reward fund for a deposit.

```solidity
function _subscribeRewardFund(uint8 _fundId, uint256 _depositId, uint256 _liquidity) private;
```

**Parameters**

| Name         | Type      | Description                   |
| ------------ | --------- | ----------------------------- |
| `_fundId`    | `uint8`   | The reward fund id.           |
| `_depositId` | `uint256` | The unique ID of the deposit. |
| `_liquidity` | `uint256` | The liquidity of the deposit. |

### \_unsubscribeRewardFund

Unsubscribe a reward fund from a deposit.

*The rewards claimed from the reward fund is persisted in the event.*

```solidity
function _unsubscribeRewardFund(uint8 _fundId, uint256 _depositId) private;
```

**Parameters**

| Name         | Type      | Description                               |
| ------------ | --------- | ----------------------------------------- |
| `_fundId`    | `uint8`   | The reward fund id.                       |
| `_depositId` | `uint256` | The deposit id corresponding to the user. |


# FarmStorage

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/FarmStorage.sol)

**Inherits:** IFarm

**Author:** Sperax Foundation.

This contract contains the base storage variables for farms.

## State Variables

### COMMON\_FUND\_ID

```solidity
uint8 public constant COMMON_FUND_ID = 0;
```

### LOCKUP\_FUND\_ID

```solidity
uint8 public constant LOCKUP_FUND_ID = 1;
```

### PRECISION

```solidity
uint256 public constant PRECISION = 1e18;
```

### MAX\_COOLDOWN\_PERIOD

```solidity
uint256 public constant MAX_COOLDOWN_PERIOD = 30;
```

### MAX\_NUM\_REWARDS

```solidity
uint256 public constant MAX_NUM_REWARDS = 4;
```

### farmId

```solidity
string public farmId;
```

### isPaused

```solidity
bool internal isPaused;
```

### isClosed

```solidity
bool internal isClosed;
```

### cooldownPeriod

```solidity
uint256 public cooldownPeriod;
```

### lastFundUpdateTime

```solidity
uint256 public lastFundUpdateTime;
```

### farmStartTime

```solidity
uint256 public farmStartTime;
```

### totalDeposits

```solidity
uint256 public totalDeposits;
```

### rewardFunds

```solidity
RewardFund[] internal rewardFunds;
```

### rewardTokens

```solidity
address[] internal rewardTokens;
```

### rewardData

```solidity
mapping(address => RewardData) internal rewardData;
```

### deposits

```solidity
mapping(uint256 => Deposit) internal deposits;
```

### subscriptions

```solidity
mapping(uint256 => Subscription[]) internal subscriptions;
```


# FarmRegistry

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/FarmRegistry.sol)

**Inherits:** IFarmRegistry, OwnableUpgradeable

**Author:** Sperax Foundation.

This contract tracks fee details, privileged users, deployed farms and farm deployers.

## State Variables

### farms

```solidity
address[] internal farms;
```

### deployerList

```solidity
address[] internal deployerList;
```

### feeReceiver

```solidity
address public feeReceiver;
```

### feeToken

```solidity
address public feeToken;
```

### feeAmount

```solidity
uint256 public feeAmount;
```

### extensionFeePerDay

```solidity
uint256 public extensionFeePerDay;
```

### farmRegistered

```solidity
mapping(address => bool) public farmRegistered;
```

### deployerRegistered

```solidity
mapping(address => bool) public deployerRegistered;
```

### isPrivilegedUser

```solidity
mapping(address => bool) public isPrivilegedUser;
```

## Functions

### constructor

```solidity
constructor();
```

### initialize

constructor

```solidity
function initialize(address _feeReceiver, address _feeToken, uint256 _feeAmount, uint256 _extensionFeePerDay)
    external
    initializer;
```

**Parameters**

| Name                  | Type      | Description                               |
| --------------------- | --------- | ----------------------------------------- |
| `_feeReceiver`        | `address` | Receiver of the fees.                     |
| `_feeToken`           | `address` | The fee token for farm creation.          |
| `_feeAmount`          | `uint256` | The fee amount to be paid by the creator. |
| `_extensionFeePerDay` | `uint256` | Extension fee per day.                    |

### registerFarm

Register a farm created by registered Deployer.

*Only registered deployer can register a farm.*

```solidity
function registerFarm(address _farm, address _creator) external;
```

**Parameters**

| Name       | Type      | Description                          |
| ---------- | --------- | ------------------------------------ |
| `_farm`    | `address` | Address of the created farm contract |
| `_creator` | `address` | Address of the farm creator.         |

### registerFarmDeployer

Register a new farm deployer.

*Only owner can call this function.*

```solidity
function registerFarmDeployer(address _deployer) external onlyOwner;
```

**Parameters**

| Name        | Type      | Description                           |
| ----------- | --------- | ------------------------------------- |
| `_deployer` | `address` | Address of deployer to be registered. |

### removeDeployer

Remove an existing deployer from registry.

*Only owner can call this function.*

```solidity
function removeDeployer(uint16 _id) external onlyOwner;
```

**Parameters**

| Name  | Type     | Description                                       |
| ----- | -------- | ------------------------------------------------- |
| `_id` | `uint16` | ID of the deployer to be removed (0 index based). |

### updatePrivilege

Function to add/remove privileged User.

*Only callable by the owner.*

```solidity
function updatePrivilege(address _user, bool _privilege) external onlyOwner;
```

**Parameters**

| Name         | Type      | Description                                        |
| ------------ | --------- | -------------------------------------------------- |
| `_user`      | `address` | User Address for which privilege is to be updated. |
| `_privilege` | `bool`    | Privilege(bool) whether true or false.             |

### getFarmDeployerList

Get list of registered deployer.

```solidity
function getFarmDeployerList() external view returns (address[] memory);
```

**Returns**

| Name     | Type        | Description                                     |
| -------- | ----------- | ----------------------------------------------- |
| `<none>` | `address[]` | Returns array of registered deployer addresses. |

### getFarmList

Get list of farms created via registered deployer.

```solidity
function getFarmList() external view returns (address[] memory);
```

**Returns**

| Name     | Type        | Description                      |
| -------- | ----------- | -------------------------------- |
| `<none>` | `address[]` | Returns array of farm addresses. |

### getFeeParams

Get all the fee parameters for creating farm.

*It returns fee amount and extension fee as 0 if \_user is privileged.*

```solidity
function getFeeParams(address _user) external view returns (address, address, uint256, uint256);
```

**Parameters**

| Name    | Type      | Description                    |
| ------- | --------- | ------------------------------ |
| `_user` | `address` | The account creating the farm. |

**Returns**

| Name     | Type      | Description                                        |
| -------- | --------- | -------------------------------------------------- |
| `<none>` | `address` | Receiver of the fees.                              |
| `<none>` | `address` | Token in which fee is to be paid.                  |
| `<none>` | `uint256` | Amount of fees to be paid for creation of farm.    |
| `<none>` | `uint256` | Extension fee per day in case of extending a farm. |

### updateFeeParams

Update the fee params for registry.

```solidity
function updateFeeParams(address _receiver, address _feeToken, uint256 _amount, uint256 _extensionFeePerDay)
    public
    onlyOwner;
```

**Parameters**

| Name                  | Type      | Description                      |
| --------------------- | --------- | -------------------------------- |
| `_receiver`           | `address` | FeeReceiver address.             |
| `_feeToken`           | `address` | Token address for fee.           |
| `_amount`             | `uint256` | Amount of token to be collected. |
| `_extensionFeePerDay` | `uint256` | Extension fee per day.           |

### \_validateNonZeroAddr

Validate address.

```solidity
function _validateNonZeroAddr(address _addr) private pure;
```


# FarmDeployer

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/FarmDeployer.sol)

**Inherits:** Ownable, ReentrancyGuard

**Author:** Sperax Foundation.

Exposes base functionalities which will be useful in every deployer.

## State Variables

### FARM\_REGISTRY

```solidity
address public immutable FARM_REGISTRY;
```

### farmImplementation

```solidity
address public farmImplementation;
```

### farmId

```solidity
string public farmId;
```

## Functions

### constructor

Constructor.

```solidity
constructor(address _farmRegistry, string memory _farmId) Ownable(msg.sender);
```

**Parameters**

| Name            | Type      | Description                   |
| --------------- | --------- | ----------------------------- |
| `_farmRegistry` | `address` | Address of the Farm Registry. |
| `_farmId`       | `string`  | Id of the farm.               |

### updateFarmImplementation

Update farm implementation's address.

*Only callable by the owner.*

*Ensure that `_newFarmId` is correct for the new farm implementation.*

```solidity
function updateFarmImplementation(address _newFarmImplementation, string calldata _newFarmId) external onlyOwner;
```

**Parameters**

| Name                     | Type      | Description                        |
| ------------------------ | --------- | ---------------------------------- |
| `_newFarmImplementation` | `address` | New farm implementation's address. |
| `_newFarmId`             | `string`  | ID of the new farm.                |

### \_collectFee

Collect fee and transfer it to feeReceiver.

*Function fetches all the fee params from farmRegistry.*

```solidity
function _collectFee() internal virtual;
```

### \_validateNonZeroAddr

Validate address.

```solidity
function _validateNonZeroAddr(address _addr) internal pure;
```

## Events

### FarmCreated

```solidity
event FarmCreated(address indexed farm, address indexed creator, address indexed admin);
```

### FeeCollected

```solidity
event FeeCollected(address indexed creator, address indexed token, uint256 amount);
```

### FarmImplementationUpdated

```solidity
event FarmImplementationUpdated(address indexed newFarmImplementation, string newFarmId);
```

## Errors

### InvalidAddress

```solidity
error InvalidAddress();
```

### NewFarmImplementationSameAsOld

```solidity
error NewFarmImplementationSameAsOld();
```


# Features

Features contracts can be considered as plugins, which are used in farms only where they are needed.


# ClaimableFee

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/features/ClaimableFee.sol)

**Inherits:** Farm

**Author:** Sperax Foundation.

Farms build for pairs/ pools in which fee can be claimed can extend and override \_claimPoolFee function of this contract.

## Functions

### claimPoolFee

A function to claim the pool fee earned by lp.

*Only the deposit owner can call this function.*

```solidity
function claimPoolFee(uint256 _depositId) external nonReentrant;
```

**Parameters**

| Name         | Type      | Description        |
| ------------ | --------- | ------------------ |
| `_depositId` | `uint256` | ID of the deposit. |

### \_claimPoolFee

Claim pool fee internal logic to be implemented by child farm contract.

*Just override this function and write the logic to claim fee, validation and other checks are handled in `claimPoolFee`.*

```solidity
function _claimPoolFee(uint256 _depositId)
    internal
    virtual
    returns (uint256 tokenId, uint256 amt0Recv, uint256 amt1Recv);
```

**Parameters**

| Name         | Type      | Description                            |
| ------------ | --------- | -------------------------------------- |
| `_depositId` | `uint256` | Deposit ID of the deposit in the farm. |

**Returns**

| Name       | Type      | Description                                                               |
| ---------- | --------- | ------------------------------------------------------------------------- |
| `tokenId`  | `uint256` | Token ID of the deposit for E721 farms, for other farms return depositId. |
| `amt0Recv` | `uint256` | Amount 0 received as fee.                                                 |
| `amt1Recv` | `uint256` | Amount 1 received as fee.                                                 |

## Events

### PoolFeeCollected

```solidity
event PoolFeeCollected(address indexed recipient, uint256 tokenId, uint256 amt0Recv, uint256 amt1Recv);
```

## Errors

### NoFeeToClaim

```solidity
error NoFeeToClaim();
```


# ExpirableFarm

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/features/ExpirableFarm.sol)

**Inherits:** Farm

**Author:** Sperax Foundation.

This contract helps in creating farms with expiry feature.

## State Variables

### MIN\_EXTENSION

```solidity
uint256 public constant MIN_EXTENSION = 100;
```

### MAX\_EXTENSION

```solidity
uint256 public constant MAX_EXTENSION = 300;
```

### farmEndTime

```solidity
uint256 public farmEndTime;
```

### farmRegistry

```solidity
address public farmRegistry;
```

## Functions

### extendFarmDuration

Update the farm end time.

*Can be updated only before the farm expired or closed. Extension should be incremented in multiples of 1 USDs/day with minimum of 100 days at a time and a maximum of 300 days. Extension is possible only after farm started.*

```solidity
function extendFarmDuration(uint256 _extensionDays) external onlyOwner nonReentrant;
```

**Parameters**

| Name             | Type      | Description                                                         |
| ---------------- | --------- | ------------------------------------------------------------------- |
| `_extensionDays` | `uint256` | The number of days to extend the farm. Example: 150 means 150 days. |

### updateFarmStartTime

Update the farm start time.

*Can be updated only before the farm start. New start time should be in future. Adjusts the farm end time accordingly.*

```solidity
function updateFarmStartTime(uint256 _newStartTime) public virtual override;
```

**Parameters**

| Name            | Type      | Description              |
| --------------- | --------- | ------------------------ |
| `_newStartTime` | `uint256` | The new farm start time. |

### isFarmOpen

Returns bool status if farm is open. Farm is open if it is not closed and not expired.

```solidity
function isFarmOpen() public view virtual override returns (bool);
```

**Returns**

| Name     | Type   | Description                |
| -------- | ------ | -------------------------- |
| `<none>` | `bool` | bool True if farm is open. |

### \_setupFarmExpiry

Setup the farm data for farm expiry.

```solidity
function _setupFarmExpiry(uint256 _farmStartTime, address _farmRegistry) internal;
```

**Parameters**

| Name             | Type      | Description                   |
| ---------------- | --------- | ----------------------------- |
| `_farmStartTime` | `uint256` | Start time of the farm.       |
| `_farmRegistry`  | `address` | Address of the farm registry. |

### \_collectExtensionFee

Collects farm extension fee and transfers it to feeReceiver.

*Function fetches all the fee params from farmRegistry.*

```solidity
function _collectExtensionFee(uint256 _extensionDays) private;
```

**Parameters**

| Name             | Type      | Description                                                         |
| ---------------- | --------- | ------------------------------------------------------------------- |
| `_extensionDays` | `uint256` | The number of days to extend the farm. Example: 150 means 150 days. |

## Events

### FarmEndTimeUpdated

```solidity
event FarmEndTimeUpdated(uint256 newEndTime);
```

### ExtensionFeeCollected

```solidity
event ExtensionFeeCollected(address indexed token, uint256 extensionFee);
```

## Errors

### InvalidExtension

```solidity
error InvalidExtension();
```

### DurationExceeded

```solidity
error DurationExceeded();
```

### FarmNotYetStarted

```solidity
error FarmNotYetStarted();
```


# OperableDeposit

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/features/OperableDeposit.sol)

**Inherits:** Farm

**Author:** Sperax Foundation.

This contract helps in creating farms with increase/decrease deposit functionality.

## Functions

### \_updateSubscriptionForIncrease

Update subscription data of a deposit for increase in liquidity.

```solidity
function _updateSubscriptionForIncrease(uint256 _depositId, uint256 _amount) internal;
```

**Parameters**

| Name         | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| `_depositId` | `uint256` | Unique deposit id for the deposit. |
| `_amount`    | `uint256` | \_amount to be increased.          |

### \_updateSubscriptionForDecrease

Update subscription data of a deposit after decrease in liquidity.

```solidity
function _updateSubscriptionForDecrease(uint256 _depositId, uint256 _amount) internal;
```

**Parameters**

| Name         | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `_depositId` | `uint256` | Unique deposit id for the deposit |
| `_amount`    | `uint256` | \_amount to be decreased.         |

### \_increaseDeposit

Common logic for increasing a deposit.

```solidity
function _increaseDeposit(uint256 _depositId, uint256 _amount) internal;
```

**Parameters**

| Name         | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `_depositId` | `uint256` | Unique deposit id for the deposit |
| `_amount`    | `uint256` | \_amount to be decreased.         |

### \_decreaseDeposit

Common logic for decreasing a deposit.

```solidity
function _decreaseDeposit(uint256 _depositId, uint256 _amount) internal;
```

**Parameters**

| Name         | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `_depositId` | `uint256` | Unique deposit id for the deposit |
| `_amount`    | `uint256` | \_amount to be decreased.         |

## Events

### DepositIncreased

```solidity
event DepositIncreased(uint256 indexed depositId, uint256 liquidity);
```

### DepositDecreased

```solidity
event DepositDecreased(uint256 indexed depositId, uint256 liquidity);
```

## Errors

### DecreaseDepositNotPermitted

```solidity
error DecreaseDepositNotPermitted();
```

### InsufficientLiquidity

```solidity
error InsufficientLiquidity();
```


# Rewarder

Rewarder is a contract which can be used by farm admins when they want to emit rewards in fixed APR instead of fixed token amounts (by setting reward rate).


# Rewarder

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/rewarder/Rewarder.sol)

**Inherits:** IRewarder, OwnableUpgradeable, ReentrancyGuardUpgradeable

**Author:** Sperax Foundation.

This contract tracks farms, their APR and other data for a specific reward token.

*Farms for UniV3 pools using Rewarder contract must have a minimum observationCardinality of 20. It can be updated by calling increaseObservationCardinalityNext function on the pool.*

## State Variables

### MAX\_PERCENTAGE

```solidity
uint256 public constant MAX_PERCENTAGE = 1e4;
```

### APR\_PRECISION

```solidity
uint256 public constant APR_PRECISION = 1e8;
```

### REWARD\_PERIOD

```solidity
uint256 public constant REWARD_PERIOD = 1 weeks;
```

### DENOMINATOR

```solidity
uint256 public constant DENOMINATOR = 100;
```

### ONE\_YEAR

```solidity
uint256 public constant ONE_YEAR = 365 days;
```

### REWARD\_TOKEN

```solidity
address public REWARD_TOKEN;
```

### REWARD\_TOKEN\_DECIMALS

```solidity
uint8 public REWARD_TOKEN_DECIMALS;
```

### totalRewardRate

```solidity
uint256 public totalRewardRate;
```

### rewarderFactory

```solidity
address public rewarderFactory;
```

### calibrationRestricted

```solidity
mapping(address => bool) public calibrationRestricted;
```

### farmRewardConfigs

```solidity
mapping(address => FarmRewardConfig) internal farmRewardConfigs;
```

### \_decimals

```solidity
mapping(address => uint8) private _decimals;
```

## Functions

### constructor

```solidity
constructor();
```

### initialize

Initializer function of this contract.

```solidity
function initialize(address _rwdToken, address _oracle, address _admin) external initializer;
```

**Parameters**

| Name        | Type      | Description                              |
| ----------- | --------- | ---------------------------------------- |
| `_rwdToken` | `address` | Address of the reward token.             |
| `_oracle`   | `address` | Address of the USDs Master Price Oracle. |
| `_admin`    | `address` | Admin/ deployer of this contract.        |

### calibrateReward

Function to calibrate rewards for this rewarder's reward token for a farm.

*Calculates based on APR, caps based on maxRewardPerSec or balance rewards, sends and sets the rewardRate in the farm.*

```solidity
function calibrateReward(address _farm) external nonReentrant returns (uint256 rewardsToSend);
```

**Parameters**

| Name    | Type      | Description                                                     |
| ------- | --------- | --------------------------------------------------------------- |
| `_farm` | `address` | Address of the farm for which the rewards are to be calibrated. |

**Returns**

| Name            | Type      | Description                         |
| --------------- | --------- | ----------------------------------- |
| `rewardsToSend` | `uint256` | Rewards which are sent to the farm. |

### updateTokenManagerOfFarm

Function to update the token manager's address in the farm.

```solidity
function updateTokenManagerOfFarm(address _farm, address _newManager) external onlyOwner;
```

**Parameters**

| Name          | Type      | Description                                                 |
| ------------- | --------- | ----------------------------------------------------------- |
| `_farm`       | `address` | Farm's address in which the token manager is to be updated. |
| `_newManager` | `address` | Address of the new token manager.                           |

### recoverRewardFundsOfFarm

Function to recover reward funds from the farm.

```solidity
function recoverRewardFundsOfFarm(address _farm, uint256 _amount) external onlyOwner;
```

**Parameters**

| Name      | Type      | Description                                                |
| --------- | --------- | ---------------------------------------------------------- |
| `_farm`   | `address` | Farm's address from which reward funds is to be recovered. |
| `_amount` | `uint256` | Amount which is to be recovered.                           |

### updateAPR

Function to update APR.

```solidity
function updateAPR(address _farm, uint256 _apr) external onlyOwner nonReentrant;
```

**Parameters**

| Name    | Type      | Description           |
| ------- | --------- | --------------------- |
| `_farm` | `address` | Address of the farm.  |
| `_apr`  | `uint256` | APR in 1e8 precision. |

### toggleCalibrationRestriction

Function to toggle calibration restriction.

```solidity
function toggleCalibrationRestriction(address _farm) external onlyOwner;
```

**Parameters**

| Name    | Type      | Description                                                         |
| ------- | --------- | ------------------------------------------------------------------- |
| `_farm` | `address` | Address of farm for which calibration restriction is to be toggled. |

### recoverERC20

Function to recover ERC20 tokens from this contract.

```solidity
function recoverERC20(address _token, uint256 _amount) external onlyOwner;
```

**Parameters**

| Name      | Type      | Description           |
| --------- | --------- | --------------------- |
| `_token`  | `address` | Address of the token. |
| `_amount` | `uint256` | Amount of the tokens. |

### getTokenAmounts

Function to get token amounts value of underlying pool of the farm.

```solidity
function getTokenAmounts(address _farm) external view returns (address[] memory, uint256[] memory);
```

**Parameters**

| Name    | Type      | Description          |
| ------- | --------- | -------------------- |
| `_farm` | `address` | Address of the farm. |

**Returns**

| Name     | Type        | Description               |
| -------- | ----------- | ------------------------- |
| `<none>` | `address[]` | Array of token addresses. |
| `<none>` | `uint256[]` |                           |

### getFarmRewardConfig

Function to get reward config for a farm.

```solidity
function getFarmRewardConfig(address _farm) external view returns (FarmRewardConfig memory);
```

**Parameters**

| Name    | Type      | Description          |
| ------- | --------- | -------------------- |
| `_farm` | `address` | Address of the farm. |

**Returns**

| Name     | Type               | Description                          |
| -------- | ------------------ | ------------------------------------ |
| `<none>` | `FarmRewardConfig` | FarmRewardConfig Farm reward config. |

### rewardsEndTime

Function to calculate the time till which rewards are there for an LP.

```solidity
function rewardsEndTime(address _farm) external view returns (uint256 rewardsEndingOn);
```

**Parameters**

| Name    | Type      | Description                                                     |
| ------- | --------- | --------------------------------------------------------------- |
| `_farm` | `address` | Address of the farm for which the end time is to be calculated. |

**Returns**

| Name              | Type      | Description                                                                    |
| ----------------- | --------- | ------------------------------------------------------------------------------ |
| `rewardsEndingOn` | `uint256` | Timestamp in seconds till which the rewards are there in farm and in rewarder. |

### updateRewardConfig

Function to update the REWARD\_TOKEN configuration. This function calibrates reward so token manager must be updated to address of this contract in the farm.

```solidity
function updateRewardConfig(address _farm, FarmRewardConfigInput memory _rewardConfig) public onlyOwner nonReentrant;
```

**Parameters**

| Name            | Type                    | Description                                                |
| --------------- | ----------------------- | ---------------------------------------------------------- |
| `_farm`         | `address`               | Address of the farm for which the config is to be updated. |
| `_rewardConfig` | `FarmRewardConfigInput` | The config which is to be set.                             |

### \_initialize

Internal initialize function.

```solidity
function _initialize(address _rwdToken, address _oracle, address _admin, address _rewarderFactory) internal;
```

**Parameters**

| Name               | Type      | Description                              |
| ------------------ | --------- | ---------------------------------------- |
| `_rwdToken`        | `address` | Address of the reward token.             |
| `_oracle`          | `address` | Address of the USDs Master Price Oracle. |
| `_admin`           | `address` | Admin/ deployer of this contract.        |
| `_rewarderFactory` | `address` | Address of Rewarder factory contract.    |

### \_isConfigured

Function to check if the farm's reward is configured.

```solidity
function _isConfigured(address _farm) internal view;
```

**Parameters**

| Name    | Type      | Description          |
| ------- | --------- | -------------------- |
| `_farm` | `address` | Address of the farm. |

### \_getTokenAmounts

An internal function to get token amounts for the farm.

```solidity
function _getTokenAmounts(address _farm) internal view virtual returns (address[] memory, uint256[] memory);
```

**Parameters**

| Name    | Type      | Description          |
| ------- | --------- | -------------------- |
| `_farm` | `address` | Address of the farm. |

**Returns**

| Name     | Type        | Description               |
| -------- | ----------- | ------------------------- |
| `<none>` | `address[]` | Array of token addresses. |
| `<none>` | `uint256[]` | Array of token amounts.   |

### \_hasRewardToken

Function to check if the reward token of this contract is one of farm's reward token.

```solidity
function _hasRewardToken(address _farm) internal view virtual returns (bool);
```

**Parameters**

| Name    | Type      | Description          |
| ------- | --------- | -------------------- |
| `_farm` | `address` | Address of the farm. |

**Returns**

| Name     | Type   | Description                                                           |
| -------- | ------ | --------------------------------------------------------------------- |
| `<none>` | `bool` | If farm has one of the reward token as reward token of this contract. |

### \_validateNonZeroAddr

Validate address.

```solidity
function _validateNonZeroAddr(address _addr) internal pure;
```

**Parameters**

| Name    | Type      | Description              |
| ------- | --------- | ------------------------ |
| `_addr` | `address` | Address to be validated. |

### \_calibrateReward

```solidity
function _calibrateReward(address _farm) private returns (uint256 rewardsToSend);
```

### \_setRewardRate

Function to set reward rate in the farm.

```solidity
function _setRewardRate(address _farm, uint128 _rwdRate, uint256 _nonLockupRewardPer) private;
```

**Parameters**

| Name                  | Type      | Description                                          |
| --------------------- | --------- | ---------------------------------------------------- |
| `_farm`               | `address` | Address of the farm.                                 |
| `_rwdRate`            | `uint128` | Reward per second to be emitted.                     |
| `_nonLockupRewardPer` | `uint256` | Reward percentage to be allocated to no lockup fund. |

### \_adjustGlobalRewardRate

Function to adjust global rewards per second emitted for a reward token.

```solidity
function _adjustGlobalRewardRate(uint256 _oldRewardRate, uint256 _newRewardRate) private;
```

**Parameters**

| Name             | Type      | Description        |
| ---------------- | --------- | ------------------ |
| `_oldRewardRate` | `uint256` | Old emission rate. |
| `_newRewardRate` | `uint256` | New emission rate. |

### \_isValidFarm

Function to validate farm.

*It checks that the farm should implement getTokenAmounts and have REWARD\_TOKEN. as one of the reward tokens.*

```solidity
function _isValidFarm(address _farm, address[] memory _baseTokens) private returns (bool);
```

**Parameters**

| Name          | Type        | Description                          |
| ------------- | ----------- | ------------------------------------ |
| `_farm`       | `address`   | Address of the farm to be validated. |
| `_baseTokens` | `address[]` | Array of base tokens.                |

**Returns**

| Name     | Type   | Description                 |
| -------- | ------ | --------------------------- |
| `<none>` | `bool` | bool True if farm is valid. |

### \_hasBaseTokens

Function to check whether the base tokens are a subset of farm's assets.

*It handles repeated base tokens as well and pushes indexed in farmRewardConfigs.*

```solidity
function _hasBaseTokens(address _farm, address[] memory _baseTokens) private returns (bool);
```

**Parameters**

| Name          | Type        | Description                                                           |
| ------------- | ----------- | --------------------------------------------------------------------- |
| `_farm`       | `address`   | Address of the farm.                                                  |
| `_baseTokens` | `address[]` | Array of base token addresses to be considered for value calculation. |

**Returns**

| Name     | Type   | Description                                                                    |
| -------- | ------ | ------------------------------------------------------------------------------ |
| `<none>` | `bool` | hasBaseTokens True if baseTokens are non redundant and are a subset of assets. |

### \_normalizeAmount

Function to normalize asset amounts to be of precision REWARD\_TOKEN\_DECIMALS.

```solidity
function _normalizeAmount(address _token, uint256 _amount) private view returns (uint256);
```

**Parameters**

| Name      | Type      | Description                 |
| --------- | --------- | --------------------------- |
| `_token`  | `address` | Address of the asset token. |
| `_amount` | `uint256` | Amount of the token.        |

**Returns**

| Name     | Type      | Description                                           |
| -------- | --------- | ----------------------------------------------------- |
| `<none>` | `uint256` | Normalized amount of the token in \_desiredPrecision. |

### \_getPrice

Function to fetch and get the price of a token.

```solidity
function _getPrice(address _token, address _oracle) private view returns (IOracle.PriceData memory priceData);
```

**Parameters**

| Name      | Type      | Description                                     |
| --------- | --------- | ----------------------------------------------- |
| `_token`  | `address` | Token for which the the price is to be fetched. |
| `_oracle` | `address` | Address of the oracle contract.                 |

**Returns**

| Name        | Type                | Description              |
| ----------- | ------------------- | ------------------------ |
| `priceData` | `IOracle.PriceData` | Price data of the token. |

### \_validatePriceFeed

Function to validate price feed.

```solidity
function _validatePriceFeed(address _token, address _oracle) private view;
```

**Parameters**

| Name      | Type      | Description            |
| --------- | --------- | ---------------------- |
| `_token`  | `address` | Token to be validated. |
| `_oracle` | `address` | Address of the oracle. |

### \_validateRewardPer

Function to validate the no lockup fund's reward percentage.

```solidity
function _validateRewardPer(uint256 _percentage) private pure;
```

**Parameters**

| Name          | Type      | Description                                         |
| ------------- | --------- | --------------------------------------------------- |
| `_percentage` | `uint256` | No lockup fund's reward percentage to be validated. |


# RewarderFactory

[Git Source](https://github.com/Sperax/Demeter-Protocol/blob/cc93b9106874316d6dd016cdace652e2ca4ef8e1/contracts/rewarder/RewarderFactory.sol)

**Inherits:** IRewarderFactory, Ownable

**Author:** Sperax Foundation.

This contract deploys new rewarders and keeps track of them.

## State Variables

### oracle

```solidity
address public oracle;
```

### rewarderImplementation

```solidity
address public rewarderImplementation;
```

## Functions

### constructor

Constructor.

```solidity
constructor(address _oracle) Ownable(msg.sender);
```

**Parameters**

| Name      | Type      | Description                                 |
| --------- | --------- | ------------------------------------------- |
| `_oracle` | `address` | Address of the master price oracle of USDs. |

### deployRewarder

Function to deploy new rewarder.

```solidity
function deployRewarder(address _rwdToken) external returns (address rewarder);
```

**Parameters**

| Name        | Type      | Description                                                           |
| ----------- | --------- | --------------------------------------------------------------------- |
| `_rwdToken` | `address` | Address of the reward token for which the rewarder is to be deployed. |

**Returns**

| Name       | Type      | Description         |
| ---------- | --------- | ------------------- |
| `rewarder` | `address` | Rewarder's address. |

### updateRewarderImplementation

Update rewarder implementation's address

```solidity
function updateRewarderImplementation(address _newRewarderImplementation) external onlyOwner;
```

**Parameters**

| Name                         | Type      | Description                 |
| ---------------------------- | --------- | --------------------------- |
| `_newRewarderImplementation` | `address` | New Rewarder Implementation |

### updateOracle

Function to update the oracle's address.

```solidity
function updateOracle(address _newOracle) public onlyOwner;
```

**Parameters**

| Name         | Type      | Description                |
| ------------ | --------- | -------------------------- |
| `_newOracle` | `address` | Address of the new oracle. |

### \_validateNonZeroAddr

Validate address.

```solidity
function _validateNonZeroAddr(address _addr) private pure;
```

**Parameters**

| Name    | Type      | Description              |
| ------- | --------- | ------------------------ |
| `_addr` | `address` | Address to be validated. |


# Deployed contracts

<table><thead><tr><th width="200">Name</th><th>Explorer link</th></tr></thead><tbody><tr><td>FarmRegistry</td><td><a href="https://arbiscan.io/address/0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0">https://arbiscan.io/address/0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0</a></td></tr><tr><td>RewarderFactory</td><td><a href="https://arbiscan.io/address/0x926477bAF60C25857419CC9Bf52E914881E1bDD3">https://arbiscan.io/address/0x926477bAF60C25857419CC9Bf52E914881E1bDD3</a></td></tr><tr><td>CamelotV3Deployer</td><td><a href="https://arbiscan.io/address/0x212208daF12D7612e65fb39eE9a07172b08226B8">https://arbiscan.io/address/0x212208daF12D7612e65fb39eE9a07172b08226B8</a></td></tr></tbody></table>


# Getting Started on Our DApp

Visit our [dApp](https://app.sperax.io/) to Mint, Redeem and Farm.

Go through [this YouTube Playlist](https://www.youtube.com/playlist?list=PLFLJXUn7GDG9j3T1ZFO2Vlh03vHjsyssC) for step-by-step tutorials on how to use and navigate the Sperax ecosystem.


# Minting & Redeeming USDs

Users can mint USDs from their collateral (USDC.e, USDC or USDT). The Mint page will automatically reflect the amount of collateral and SPA required to mint USDs (Currently, no SPA required). Users can redeem USDs for a collateral of their choice.

### Minting USDs

* Make sure your wallet holds eligible collateral (USDC, USDT or USDC.e).
* Go to the [dApp](https://app.sperax.io/) homepage and connect your wallet.&#x20;
* Select the collateral and enter the amount of collateral that you want to deposit.
* View the Latest Auto-Yield APY before proceeding.
* The app will automatically show how much USDs you can mint. Then click on ‘Mint USDs’ and review ‘Max Slippage’.
* Then, you have to approve 2 transactions on your wallet - Approve and Sell USDC - after clicking ‘Confirm’.
* You can now view your USDs balance in your wallet.

{% embed url="<https://youtu.be/OVsDsn9ckvI>" %}

### Redeeming USDs

1. Go to the [dApp](https://app.sperax.io/) homepage and connect your wallet.&#x20;
2. Select the Redeem tab and enter the amount of USDs you would like to redeem.
3. You can also select the maximum slippage for the transaction and then select the token in which you want to redeem.  You can view the redemption fee and redemption amount as well.
4. Now, click on 'Redeem USDs' to redeem.
5. Click on 'Confirm' and unlock USDs transfer by providing required consent.
6. Then approve the transaction and your USDs will be redeemed succesfully.

{% embed url="<https://www.youtube.com/watch?v=sC8Z6zPXkZc&list=PLFLJXUn7GDG9j3T1ZFO2Vlh03vHjsyssC&index=2>" %}


# Staking SPA

{% embed url="<https://www.loom.com/share/bae33ebdabfe437dbb634781890eaaec>" %}

### Stake SPA

1. Visit the [**stake page**](https://www.app.sperax.io/stake)**.**
2. Choose amount of SPA you want to stake, lockup period and you can check veSPA balance corresponding to that.
3. Click on Stake to stake your SPA.
4. Once the transaction is processed, you can see your&#x20;
   * veSPA balance
   * SPA staked&#x20;
   * Expiry date
   * Button to extend lockup period

### Extend Lockup for staked SPA

1. Click on the 'Extend Lockup' button.
2. Select how much you want to extend your lockup period. You can see the updated expiry date and veSPA balance.
3. Click on Extend Lockup.

### Increase Staked Balance

1. Select additional amount of SPA tokens you want to stake.
2. You can see veSPA balance corresponding the same lockup as your existing veSPA balance.&#x20;
3. Click on Stake to stake additional amount of SPA. The new veSPA balance will also expire at the same time as the previous balance.&#x20;


# Governance

veSPA holders will deliberate on protocol governance

**Sperax has launched its off-chain governance process. On-chain governance protocol will be launched next. Through governance, community can make changes to the USDs protocol parameters, bring in new partnerships, new yield opportunities etc.**&#x20;

### **Sperax Off-Chain Governance Process:**

The Sperax DAO governance process primarily utilizes the Sperax DAO Governance [Forum](https://forum.sperax.io/). In order for a proposal to be accepted, it must go through the following phases:

#### **Phase 0**: Casual Ideation (Discord):

If you have an idea you’d like to share, please feel free to post it in [#DAO-discussion](https://discord.gg/DbCVGa8J8a) channel on Sperax Discord, or, if you prefer to submit a proposal, you can use the [SIP Template](https://forum.sperax.io/t/sperax-proposal-template/637) and submit your concept in the [Proposal (Active Discussion)](https://forum.sperax.io/c/proposals-active-discussion/19) channel.

Ideation Flow:

1. Start a conversation in the official governance channel in Discord.
2. Gather feedback from the community.
3. (Optional) Create a poll on discord to gauge community sentiment.
4. (Optional) If you’d like to talk about your idea on a Sperax Community Call, feel free to contact a team member via Discord to coordinate.

#### **Phase 1**: Governance Proposal (On Forum)

If you are ready to submit a formal proposal, you may do so on the [Proposal (Active Discussion)](https://forum.sperax.io/c/proposals-active-discussion/19) channel using the [SIP Template](https://forum.sperax.io/t/sperax-proposal-template/637). Here you’ll begin to receive constructive feedback from the community as well as the Sperax team. Discussion will continue for a minimum of 48 hours.

Make sure to add the correct tag to the proposal(see below for definitions):

1. USDs parameter: Proposals related to adjusting/modifying USDs components.
2. New Assets and Yield Strategies: Proposals related to adding new forms of collateral and yield strategy schemes/methodologies.
3. Liquidity Mining: Proposals related to the improvement of Sperax farming & liquidity mining mechanisms.
4. Product Feature: Proposals related to the improvement, addition, or modification of new & existing Sperax products.
5. Partnership(s): Proposals related to inquiring & establishing potential partnerships with the Sperax Protocol.
6. Other: Miscellaneous proposals that have yet to be assigned a defined tag/category.

{% embed url="<https://www.youtube.com/watch?v=eOS12xByBRc>" %}
**Tutorial for using Sperax Forum**
{% endembed %}

#### **Phase 2**: Snapshot vote:

Once a proposal has gained traction, a snapshot poll will be created for voting. A Moderator will proceed to create the snapshot poll, link it to the corresponding forum post, and submit it on the [Snapshot Voting](https://forum.sperax.io/c/snapshot-voting/17) channel on Forum. Votes can be cast directly through [Sperax Snapshot Space](https://snapshot.org/#/speraxdao.eth).

All snapshot polls will last **3 days upon initiation**. Votes will be weighed by the voters' veSPA balance. A snapshot poll will include ***2 vote options (Yes/ No)*** by default. If proposal creator wants 3 vote options (Yes/ No/ Yes with modification) then they can inform that to the moderators while snapshot poll is created. If 'Yes with modification' option gets max votes, then the proposal is not subject to cooldown period.&#x20;

***Proposal Passing Criteria:***

1. Acceptance Threshold: Proposal must receive more than 50% in "Yes" votes&#x20;
2. Minimum Quorum: At least 200 Million veSPA should vote in the snapshot poll

***Possible outcomes at this stage:***

1. **Both the proposal passing criteria are met**: the proposal passes and escalates to a Sperax Improvement Plan (SIP).
2. **Quorum is not met**: The proposal does not meet minimum quorum and is marked “Defeated” by the moderators. The proposal undergoes a 7-day cooldown period. At the conclusion of this period, the proposer can resubmit the proposal and proceed with the governance process.
3. **Quorum is met but does not receive more than 50% in 'Yes' votes**: The post is marked as ‘Defeated’ by the moderators.&#x20;
   * If “No” votes > “Yes with modification” votes - The proposal must then undergo a 7-day cooldown period. Afterward, the proposer must then resubmit the proposal, along with any necessary modifications, and proceed with the governance process.
   * If “Yes with modification” votes >= “No” votes - The proposal can be returned to the deliberation phase for modifications and is not subject to the 7-day cooldown period. Once modifications are made to the proposal it can be elevated to a Snapshot vote once again.

#### **Phase 3**: Sperax Improvement Plan (SIP):

When a governance proposal passes the snapshot vote in the previous stage, the proposal moves to Sperax Improvement Plan. This will have the list of all accepted proposals. The Sperax engineering team will pick up proposals from SIP for implementation based on their priorities and bandwidth. Community can also help write the code for implementing proposals from SIP. All codes will have to be audited before implementation. Sperax Foundation will help in facilitating the audits.

Check the repository of all the winning proposals

{% embed url="<https://forum.sperax.io/c/approved-sips/18>" %}

Track the implementation of these proposals&#x20;

{% embed url="<https://app.asana.com/read-only/Sperax-Improvement-Plan/1155432754926826/42636fa165840f99ec4b72c5081ee4e9/board>" %}


# Bug Bounty Program

## Introduction

The Security of Sperax’s USDs and Demeter users is paramount. The engineering team and our auditors have invested significant time and resources to ensure that USDs and Demeter are secure and dependable. The USDs and Demeter smart contracts are publicly verifiable. The details and statistics of circulating supply, underlying collateral, collateral strategies, Farms etc are publicly available.

On 1st March 2024 we are launching our bug bounty program. Security researchers, fulfilling the eligibility criteria as mentioned in this document, are eligible for a bug bounty for reporting undiscovered vulnerabilities. The Program aims to incentivize responsible disclosure and enhance the security of the USDs protocol and Demeter.

## Bug Bounty Program

Security is one of our core values. We value the input of hackers acting in good faith to help us maintain the highest standard for the security and safety of the Sperax ecosystem. The USDs protocol and Demeter, while it has gone through a professional audit, depends on new technology that may contain undiscovered vulnerabilities.

The Sperax team encourages the community to audit our contracts and security. We also encourage the responsible disclosure of any issues. This program is intended to recognize the value of working with the community of independent security researchers. It sets out our definition of good faith in the context of finding and reporting vulnerabilities, as well as, what you can expect from us in return.

## Scope

The Program includes the vulnerabilities and bugs in the USDs protocol core repository (located in the GitHub repositories, primarily at: <https://github.com/Sperax/USDs-v2/tree/main/contracts> and <https://github.com/Sperax/Demeter-Protocol-Contracts>. This list may change as new contracts are deployed or existing contracts are removed from usage.

The following are not within the scope of the Program:

1. Bugs in any third-party contract or platform that interacts with USDs protocol;
2. Vulnerabilities related to domains, DNS, or servers of websites;
3. Vulnerabilities already reported or discovered in contracts built by third parties on USDs;
4. Any already-reported bugs or other vulnerabilities.
5. Test contracts and staging servers unless the discovered vulnerability also affects the USDs Protocol or could otherwise be exploited in a way that risks user funds.

## Disclosure

A researcher needs to submit all bug bounty disclosures to [here](https://docs.google.com/forms/d/e/1FAIpQLScno9VE3KNuLbkQfw866lJf0yrXCedV-sk5Hdr54e9YrQ2PpA/viewform). The disclosure must include clear and concise steps to reproduce the discovered vulnerability in written or video format. The Sperax team will follow up promptly with acknowledgment of the disclosure.

#### Terms and Conditions

To be eligible for a reward under this Program, you must:

* Discover a previously unreported, non-public vulnerability within the scope of this Program. Vulnerabilities must be distinct from the issues covered in the previously conducted publicly available audits.
* Include sufficient detail in your disclosure to enable our engineers to quickly reproduce, understand, and fix the vulnerability.
* Be the first to disclose the unique vulnerability to the Team by the disclosure requirements below. If similar vulnerabilities are reported, the first submission shall be rewarded (if determined valid and otherwise in the scope of this Program)
* Be reporting in an individual capacity, or if employed by a company, reporting with the company’s written approval to submit a disclosure to Sperax
* Not be a current or former Sperax team member, vendor, contractor, or employee of a SperaxDAO vendor or contractor.
* Not be subject to any international, national, or state-level sanctions.
* Be at least 18 years of age or, if younger, submit your vulnerability with the consent of your parent or guardian.
* Not exploit the vulnerability in any way, including by making it public or obtaining a profit (other than a reward under this Program). Any publicity in any way, whether direct or indirect, relating to any bug or vulnerability will automatically disqualify it and you from the Program.

To encourage vulnerability research and to avoid any confusion between good-faith hacking and malicious attacks, we require that you:

* Play by the rules, including following the terms and conditions of this program and any other relevant agreements. If there is any inconsistency between this program and any other relevant agreements, the terms of this program will prevail.
* Report any vulnerability you’ve discovered promptly.
* Make a good faith effort to avoid privacy violations, data destruction, harming user experience, interruption, or degradation of the Sperax ecosystem and services.
* Use only the google form to submit vulnerabilities with us.
* Keep the details of any discovered vulnerabilities confidential until they are fixed.
* Perform testing only on in-scope systems, and respect systems and activities which are out-of-scope.
* Not submit a separate vulnerability caused by an underlying issue that is the same as an issue on which a reward has been paid under this Program.
* Only interact with accounts you own or with explicit permission from the account holder.
* Not engage in any unlawful conduct when disclosing the bug, including through threats, demands, or any other coercive tactics.

When working with us according to this program, you can expect us to:

* Pay generous rewards for eligible discoveries based on the severity and exploitability of the discovery, at The Sperax team's sole discretion
* Extend Safe Harbor for your vulnerability research related to this program, meaning we will not threaten or bring any legal action against anyone who makes a good faith effort to comply with our bug bounty program.
* Work with you to understand and validate your report, including a timely initial response to the submission.
* Work to remediate discovered vulnerabilities promptly.
* Recognize your contribution to improving our security if you are the first to report a unique vulnerability, and your report triggers a code or configuration change.
* All reward determinations, including eligibility and payment amount, are made at Sperax’s sole discretion. The Sperax team reserves the right to reject submissions and alter the terms and conditions of this program.

## Rewards

Sperax Treasury offers rewards for discoveries that can prevent the loss of assets, the freezing of assets, or harm to a user, commensurate with the severity and exploitability of the vulnerability. Sperax Treasury will pay a reward of $500 to $15,000 for eligible discoveries according to the terms and conditions provided below.

The Team evaluates all submissions on a case-by-case basis. Rewards are allocated based on the severity of the issue, and other variables, including, but not limited to a) the quality of the issue description, b) the instructions for reproducibility, and c) the quality of the fix (if included). A detailed report of a vulnerability increases the likelihood of a reward and may increase the reward amount. Therefore, please provide as much information about the vulnerability as possible.

The Program intends to follow a similar approach as the Ethereum Bug Bounty, where the severity of the issues will be based according to the OWASP risk rating model based on “Impact” and “Likelihood”. The evaluation of scoring is however at the sole discretion of the Sperax Team.

All rewards are paid in SPA and xSPA tokens with a 50-50 split (15-day TWAP) via a transfer to the wallet address provided by the participant to the Team. As a condition of participating in this Program, the participants give the Sperax Team permission to share their wallet addresses and other information provided by them to third parties to administer this Program and comply with applicable laws, regulations, and rules.

The reward will be received in SPA token based on the following severity scheme:

* Note = Up to 100 US dollars
* Very low = Up to 500 US dollars
* Low = Up to 1,000 US dollars
* Medium = Up to 2,500 US dollars
* High = Up to 5,000 US dollars
* Very High = Up to 10,000 US dollars
* Critical = Up to 15,000 US dollars

| Likelihood/Severity | Very Low | Low   | Moderate | High   | Critical |
| ------------------- | -------- | ----- | -------- | ------ | -------- |
| Almost certain      | $1000    | $2500 | $5000    | $10000 | $15000   |
| Likely              | $500     | $1000 | $2500    | $5000  | $10000   |
| Possible            | $100     | $500  | $1000    | $2500  | $5000    |
| Unlikely            | $100     | $100  | $500     | $1000  | $2500    |
| Almost Possible     | $100     | $100  | $100     | $500   | $1000    |

## Other terms

The decisions made regarding rewards are final and binding.

By submitting your report, you grant the Company all rights, including without limitation intellectual property rights, needed to validate, mitigate, and disclose the vulnerability. All reward decisions, including eligibility for and amounts of the rewards and how such rewards will be paid, are made at the Company's sole discretion.

Terms and conditions of the Program may be altered at any time. The company may change or cancel this Program at any time, for any reason.


# SPA Tokenomics

Token distribution schedule, details of tokens held by the foundation and community treasury

### SPA Circulating Supply Calculation Logic

`Circulating Supply = Total Supply of SPA on Ethereum + Total Supply of SPA on Arbitrum + Total Supply of wSPA on Ethereum - wSPA locked on Arbitrum bridge - SPA balance held by major wallets - SPA locked in SPA Staking Protocol`

### Important contract addresses:

SPA token address (Ethereum): 0xb4a3b0faf0ab53df58001804dda5bfc6a3d59008

SPA token address (Arbitrum): 0x5575552988A3A80504bBaeB1311674fCFd40aD4B

wSPA (wrapped SPA) token address (Ethereum): 0x2a95FE4c7e64e09856989F9eA0b57B9AB5f770CB

Arbitrum bridge where wSPA is locked (Ethereum): 0xcEe284F754E854890e311e3280b767F80797180d

### Major wallets with SPA tokens

<table><thead><tr><th width="150">Name</th><th width="256">Address</th><th width="411">Vesting &#x26; Purpose</th><th>Initial Allocation</th><th>% of Initial Supply</th></tr></thead><tbody><tr><td>Treasury</td><td><p><a href="https://etherscan.io/address/0x4a692fd139259a5b94cad7753e3c96350b7f2b9f">0x4a692fD139259a5b94Cad7753E3C96350b7F2B9f</a></p><p></p><p><a href="https://arbiscan.io/address/0xba6ca0b9e7333f5e667816b85704c024ab250c9d">0xBA6ca0B9e7333f5e667816b85704c024AB250C9D<br></a><br><a href="https://arbiscan.io/address/0x8898A38Eb8E3104f7c98622b55260E014B3a0217">0x8898A38Eb8E3104f7c98622b55260E014B3a0217</a></p></td><td>This vests linearly over a 4-year time-lock, beginning from the launch date of governance protocol. The DAO will control this fund and utilize for future partnerships, marketing incentives, liquidity mining rewards, etc.</td><td>1,250,000,000</td><td>25%</td></tr><tr><td>Foundation</td><td><p><a href="https://etherscan.io/address/0xd95791bcab484c0552833cb558d18d4d3f198af9">0xD95791bcab484C0552833cB558d18d4D3F198AF9</a>  </p><p><a href="https://arbiscan.io/address/0xb56e5620a79cfe59af7c0fcae95aadbea8ac32a1">0xb56e5620A79cfe59aF7c0FcaE95aADbEA8ac32A1</a></p><p> <a href="https://etherscan.io/address/0xC6e00e0E3544C93460cdFb53E85C4528EF348265">0xC6e00e0E3544C93460cdFb53E85C4528EF348265</a><br><br></p></td><td>Foundation funds are being used to make initial markets and for protocol development. Since the foundation lends the tokens to third parties for market making activities, the actual token balance held in the foundation wallet will fluctuate. <strong>Foundation has burnt 375MM SPA in 2022 to further decentralise the protocol - 250MM SPA in May and 125MM SPA in September.</strong> <a href="https://etherscan.io/address/0xC6e00e0E3544C93460cdFb53E85C4528EF348265">0xC6e00e0E3544C93460cdFb53E85C4528EF348265</a> is an operator wallet which is sometimes used to move tokens from Layer 1 to Layer 2. </td><td>1,250,783,000</td><td>25.02%</td></tr><tr><td>Bootstrap Liquidity</td><td><a href="https://etherscan.io/address/0x8b65ce3b4eaa8958346096c3a9303b73f2012acc">0x8B65CE3b4Eaa8958346096C3a9303b73f2012aCc</a><br><br><a href="https://arbiscan.io/address/0xaf64e027d42bac1c14277fd295de9ae318eef17e">0xAF64e027D42bAc1C14277fd295De9Ae318eEF17E</a></td><td>This will be used to provide rewards for liquidity mining during protocol genesis. Future liquidity mining rewards will be funded from treasury funds</td><td>500,000,000</td><td>10%</td></tr><tr><td>Staking Rewards</td><td><p><a href="https://etherscan.io/address/0xcd1b1ce6ce877a9315e73e2e4ba3137228068a59">0xCD1B1ce6ce877a9315E73E2E4Ba3137228068A59</a></p><p><a href="https://arbiscan.io/address/0x3702e3e2db2b5d037c1dbb23ab7a51d0cc90bd0e">0x3702E3e2DB2b5d037c1dbB23Ab7A51d0Cc90BD0e</a><br></p></td><td>This will be used to reward users who stake $SPA in the staking protocol. Stakers will earn fees from the minting and redeeming of $USDs, as well as staking rewards from the allocated rewards budget.</td><td>500,000,000</td><td>10%</td></tr><tr><td>Team &#x26; Advisor</td><td><a href="https://arbiscan.io/address/0xE10b88d70b01b956782Dc98d7D4f3a931FF59Fc7">0xE10b88d70b01b956782Dc98d7D4f3a931FF59Fc7</a></td><td>This vests linearly over 4 years with a 6 month cliff. Token unlock schedule will start from 4/1/2022 for existing team members. For new members, vesting would start at least three months from the day they join.</td><td>499,217,000</td><td>9.98%</td></tr><tr><td>Private Sale</td><td><a href="https://etherscan.io/address/0x2fc8d8bcf4b2c0fc6594475e44c473ac3e844b6a">0x2Fc8d8BCf4b2c0fc6594475E44c473AC3E844B6a</a></td><td>All SPA tokens have been vested under a strict vesting schedule of 1 year starting from 9/18/2021.</td><td>750,000,000</td><td>15%</td></tr></tbody></table>

### Staking Protocol Related

| Title                | Chain    | Contract / Wallet Address                  |
| -------------------- | -------- | ------------------------------------------ |
| veSPA L1             | Ethereum | 0xbF82a3212e13b2d407D10f5107b5C8404dE7F403 |
| veSPA L2             | Arbitrum | 0x2e2071180682Ce6C247B1eF93d382D509F5F6A17 |
| RewardDistributor L1 | Ethereum | 0xa61DD4480BE2582283Afa54E461A1d3643b36040 |
| RewardDistributor L2 | Arbitrum | 0x2c07bc934974BbF413a4a4CeDA98713DCb8d9e16 |
| Staking Reward       | Arbitrum | 0x3702E3e2DB2b5d037c1dbB23Ab7A51d0Cc90BD0e |

### Bootstrap Liquidity Related

Tokens from Bootstrap Liquidity have been moved to a lot of Farm rewarder contracts and  deployer wallet addresses for operational reasons. Please find below the list of those addresses. We will try our best to keep this list constantly updated.&#x20;

| Title                          | Chain                  | Contract / Wallet Address                                                                                            |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Bootstrap Liquidity            | Ethereum               | 0x8B65CE3b4Eaa8958346096C3a9303b73f2012aCc                                                                           |
| Bootstrap liquidity deployer   | Ethereum  and Arbitrum | 0xc28c6970D8A345988e8335b1C229dEA3c802e0a6                                                                           |
| USDs/USDC Farm Rewarder (SPA)  | Arbitrum               | 0x1733c5bc884090C73D89303467461693c54Ba58B                                                                           |
| SPA/USDs Farm Rewarder 1 (SPA) | Arbitrum               | 0x136C218Ff8E87eD68f851433685960819F06b1fE                                                                           |
| USDs/USDC Farm Vesting (SPA)   | Arbitrum               | 0x638d76763dE9492b609b0d8830D8F626C5933A4D                                                                           |
| SPA/USDs Farm Vesting (SPA)    | Arbitrum               | 0x03b35477cFD400dEdfAc06f40422491500cbc663                                                                           |
| SPA/USDs Farm Rewarder 2 (SPA) | Arbitrum               | 0x36033594EC23E0f0B187f767889Eb4C539F4aE03                                                                           |
| SPA/USDs Farm Vesting 2 (SPA)  | Arbitrum               | 0xC0F0484a216AfF20E0ead1a1513cE40fe0AFe0fe                                                                           |
| SPA-Reserve-L2 multi-sig       | Arbitrum               | 0xb56e5620A79cfe59aF7c0FcaE95aADbEA8ac32A1                                                                           |
| SPA Farm                       | Arbitrum               | [0xc150cbdDC5932258fAc768bEB4d2352D127039fd](https://arbiscan.io/address/0xc150cbdDC5932258fAc768bEB4d2352D127039fd) |
| SPA Farm rewarder              | Arbitrum               | [0x852afF031bb282C054B26628A799D7F3a896873e](https://arbiscan.io/address/0x852afF031bb282C054B26628A799D7F3a896873e) |
| Bootstrap liquidity Arbitrum   | Arbitrum               | 0xAF64e027D42bAc1C14277fd295De9Ae318eEF17E                                                                           |

### SPA Buyback

The SPA that is bought back from the open markets using 30% of the auto-yield and 100% of the fees is stored in : [0xA61a0719e9714c95345e89a2f1C83Fae6f5745ef](https://arbiscan.io/address/0xA61a0719e9714c95345e89a2f1C83Fae6f5745ef#tokentxns) (Arbitrum One)\
\
SPA circulating supply [sheet](https://docs.google.com/spreadsheets/d/1OSrHKR4Rpe5U6HgNN7p8XHd_VpQmB6upqLUYZG89yZ4/edit?usp=sharing) which is in Beta. It can be used to view the circulating supply breakdown for the token.&#x20;


# xSPA token

xSPA is a reward token of the Sperax ecosystem. xSPA can be either staked for veSPA with a lockup of 180 days or more, or redeemed within 15 to 180 days giving 50% to 100% SPA upon redemption.

#### **Summary / Abstract**

Earlier in 2023, SperaxDAO decided on the SPA budget for emission through Gauge ([SIP-32](https://snapshot.org/#/speraxdao.eth/proposal/0x02b1043150b2abc2147bf5c7892559d9d88afa23e5765f799131a29c024ffaf6)) and redirecting veSPA emissions to bribes on Gauge ([SIP-33](https://snapshot.org/#/speraxdao.eth/proposal/0xf4c19cef7f1cb44e91e21c04c877d9389ad5391869669f3da11b8ae152c7ea2b)). Every week, Gauge emits 2.9 M SPA and veSPA voters are bribed 383K SPA. This SPA should be used more prominently and assertively to drive USDs growth and bring new adoption.

#### Motivation

Since the start of SPA Gauge, USDs total supply has decreased from $2M to $1.78M. In the meantime, SPA Gauge has emitted about 80M SPA amounting to $392K. The SPA circulating supply has increased from 1.593B to 1.658B.

Emitting SPA in a predetermined manner and without assessing the market dynamics is improper utilization of resources. Since our target is to increase USDs adoption which will help in growing the Sperax ecosystem and its participants, we must rethink our overall strategy.

#### Overview

Apart from maintaining the target to make SPA deflationary, SperaxDAO should ensure that the emission is invested back into the ecosystem and contributes directly towards increasing the USDs adoption and supply.

All SPA emissions should have a looping effect such that a good portion of SPA distributed should be invested back into the ecosystem in the form of veSPA and increase the burning rate of SPA.\
Since the emissions are not helping in increasing either USDs adoption or the locked tokens. The recent increment in veSPA numbers is primarily driven by the team token allocation in veSPA. The Sperax ecosystem is steadily moving towards complete decentralization of protocols and hence should have more governance participation.

The Sperax ecosystem should have a new reward token. A token which can be staked as veSPA or redeemed for SPA. After drawing some inspiration from the Camelot emission strategy, the core team proposes the launch of a new token called xSPA. Users can either stake 1 xSPA for one veSPA or redeem 1 xSPA for 1 SPA.

#### Technical overview

Users can redeem 1 xSPA token for SPA by depositing their xSPA token through the redemption contract. Users can stake 1 xSPA in veSPA to increase their staked SPA balance. The relation between xSPA, SPA, and veSPA will be governed by the following rules

* 1 xSPA will be equivalent to 1 SPA.
* Users can redeem 1 xSPA for 1 SPA if they lock the xSPA in the redemption contract for 180 days, the maximum redemption period.
* Users can redeem 1 xSPA for 0.5 SPA if they lock the xSPA in the redemption contract of 15 days, the minimum redemption period.
* If the redemption period is ‘x’, between 15 and 180 days, the amount of SPA a user gets is governed by the following equation:\
  \
  \&#xNAN;*`Receivable spaAmount = (_xSpaAmount * (_redeemDuration + 150 days)) / 330 days`*
* A redemption request cannot be modified or canceled.
* The redemption contract will instantly burn any differential SPA
  * In case of the minimum locking period of 15 days, half the SPA tokens will be burnt right away and users can claim their SPA tokens after 15 days.
  * In case of a maximum locking period of 180 days, no SPA will be burnt and users can claim their SPA token after 180 days.
  * In case of a period between 15 and 180 days, SPA burnt is:\
    \
    \&#xNAN;*`SpaBurnt = _xSpaAmount - Receivable spaAmount`*\
    \
    Users can claim their SPA tokens after the locking period.
* Users can stake 1 xSPA token in the veSPA contract to increase their staked SPA balance by 1 SPA token for the existing lockup period if the lockup period is greater than 180 days.
  * If the user has 0 staked balance, the system will throw an error and will ask the user to create a staked position with a minimum staking period of 180 days
  * If the user has staked balance but the lockup is less than 180 days, the system will throw an error and ask the user to increase the locking period to a minimum of 180 days
  * Users will be able to increase their staked position if the lockup period is above 180 days.
* xSPA token is transferrable.
* The staking and redemption criteria can be updated/modified through governance.

## How to get, deposit and redeem xSPA token.

### Getting xSPA from SPA:

1. Allow xSPA token contract to transfer SPA from your account by calling [approve](https://arbiscan.io/token/0x5575552988a3a80504bbaeb1311674fcfd40ad4b#writeContract#F1) function on [SPA](https://arbiscan.io/token/0x5575552988a3a80504bbaeb1311674fcfd40ad4b) token contract by passing spender as `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` xSPA’s address and amount as the desired amount of xSPA you would like to have. Note: To allow 1 SPA pass 1000000000000000000 i.e 1e18 as amount in the approve function.
2. Call [this](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#writeProxyContract#F9) mint function on xSPA contract by passing the amount if you want to receive xSPA on your account or [this](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#writeProxyContract#F8) mint function by passing the address of the receiver account and amount if you want to receive the xSPA on another account.
3. Check your xSPA balance by calling [balanceOf](https://arbiscan.io/token/0x5575552988a3a80504bbaeb1311674fcfd40ad4b#readContract#F2) function on by passing in your account’s address.

### Depositing xSPA for redeeming SPA:

* The minimum redemption period is 15 days in which you will receive only 100/2 = 50 SPA after 15 days.
* The maximum redemption period is 180 days in which you will receive all your 100 SPA back for your 100 xSPA.
* If you select any period between 15 days to 180 days, the SPA amount redeemed would be calculated on pro rata basis between 50% to 100% of SPA for your xSPA. You can get this amount by calling [getSpaforxSPA](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#readProxyContract#F4) function on the xSPA contract by passing the xSPA amount with precision and your redeemDuration in seconds between **1296000** (15 days) to **15552000** (180 days) and it will return the SPA amount you will receive at the end of your redemption period.
* To create a redemption request you can call [createRedemptionRequest](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#writeProxyContract#F4) on the xSPA contract by passing the xSPA amount with precision and the redeem duration between the range specified above. It returns the redemption request ID which will be used to track and claim later.

### Redeeming xSPA for SPA:

* Once you have created a redemption request in the above step, you can see and track your redemption request by calling [redemptionRequests](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#readProxyContract#F7) function on the xSPA contract by passing your redemption request ID, it returns the requester’s address, unlock time in unix epoch and spa amount which will be unlocked.
* Once the current unix epoch time is more than the unlock time of the redemption request, you can call the [redeemSPA](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#writeProxyContract#F10) function by passing in your redemption request ID if you want to receive the SPA tokens on your account otherwise you can call [this](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#writeProxyContract#F11) function by passing an address of another account as receiver and your request ID to send the SPA to another account.

### Redeeming xSPA for veSPA:

* For this redemption you must have an existing veSPA lock for at least 180 days or more, if you do not have, you can call [createLock](https://arbiscan.io/address/0x2e2071180682Ce6C247B1eF93d382D509F5F6A17#writeProxyContract#F2) function on the veSPA contract by passing the amount, lock duration (minimum 180 days) and auto cooldown preference.
* If you have an active veSPA lock for at least 180 days or more, you can call [stakeXSpa](https://arbiscan.io/address/0x0966E72256d6055145902F72F9D3B6a194B9cCc3#writeProxyContract#F13) function on the xSPA token contract and your veSPA balance would be increased immediately.


# Smart Contract Addresses

### USDs Token Address

USDs L2 (Arbitrum) address: 0xD74f5255D557944cf7Dd0E45FF521520002D5748

### USDs Contract Addresses:

*

### SPA Token Addresses

#### Arbitrum One:

SPA L2 address: 0x5575552988A3A80504bBaeB1311674fCFd40aD4B

#### Ethereum

SPA L1 address: 0xB4A3B0Faf0Ab53df58001804DdA5Bfc6a3D59008

wSPA L1 address: 0x2a95FE4c7e64e09856989F9eA0b57B9AB5f770CB

**Binance Smart Chain**

SPA BSC address: 0x1A9Fd6eC3144Da3Dd6Ea13Ec1C25C58423a379b1

### xSPA Contract Address

xSPA L2 address: 0x0966E72256d6055145902F72F9D3B6a194B9cCc3

### veSPA Contract Address

#### Arbitrum One:&#x20;

Proxy contract deployed at: 0x2e2071180682Ce6C247B1eF93d382D509F5F6A17&#x20;

Implementation contract deployed at: 0xD16f5343FDDD2DcF6A8791e302A204c13069D165&#x20;

#### Ethereum:&#x20;

Proxy contract deployed at: 0xbF82a3212e13b2d407D10f5107b5C8404dE7F403&#x20;

Implementation contract deployed at: 0xA3F8745548A98ee67545Abcb0Cc8ED3129b8fF8D


# How to Transfer SPA from Ethereum to Arbitrum

Though all the Sperax and SPA functionality lives on Arbitrum now - it might happen that some early users still have SPA on the chain Sperax started with - Ethereum.&#x20;

From today's perspective, SPA held on Ethereum can be used only for transfers between on-chain accounts or for depositing SPA to CEXs supporting SPA deposits on Ethereum. SPA on Ethereum can't be used for staking, yield farming (Farms on Sperax DApp), or for voting on Snapshot.&#x20;

If you still have SPA on Ethereum Mainnet, you need to bridge it from Ethereum to Arbitrum in order to unlock SPA potential in DeFi.

The Arbitrum bridge accepts a wrapped form of SPA (wSPA), so first of all you must wrap your SPA on Ethereum in order to bridge it. Don’t worry, the value of your tokens will not change.

Below you can find instructions for transferring SPA to Arbitrum. Please make sure you have some ETH in your wallet to manage gas fees when wrapping and bridging SPA. \
\
**Please remember:** wSPA has no other function except being an intermediary token for bridging. Please don't try to send wSPA to any CEX or sell it - the transaction may fail or you can lose your tokens. Use wSPA only to bridge it to Arbitrum and get your SPA on Arbitrum.

Additionally, if your tokens do not appear after swapping or bridging, make sure you manually add [SPA token addresses](https://docs.sperax.io/faq/smart-contract-addresses) to your wallet.

**Step 1: SPA (Ethereum Mainnet) → wSPA (Ethereum Mainnet)**

1. Open [this link](https://www.app.sperax.io/convertWSPA).
2. Connect to Ethereum mainnet using your wallet using the appropriate provider.
3. Import [wSPA token](https://etherscan.io/token/0x2a95FE4c7e64e09856989F9eA0b57B9AB5f770CB) into your wallet using this token address: 0x2a95FE4c7e64e09856989F9eA0b57B9AB5f770CB
4. Enter the amount of SPA you want to convert to wSPA. Note that 1 SPA = 1 wSPA.
5. Then click on 'Swap', provide consent and send the transaction.
6. You can now see the wSPA tokens in your wallet.

{% embed url="<https://www.youtube.com/watch?v=uMSa2uQclVE>" %}

**Step 2: wSPA (Ethereum Mainnet) → SPA (Arbitrum)**

1. Navigate to [Arbitrum Bridge](https://bridge.arbitrum.io/?destinationChain=arbitrum-one\&sourceChain=ethereum). (Make sure that you are bridging from Ethereum to Arbitrum One.)
2. Connect your wallet using the appropriate provider.
3. Select wSPA token by pasting its token address: (0x2a95FE4c7e64e09856989F9eA0b57B9AB5f770CB)
4. Enter the amount of wSPA that you want to bridge. You will receive the same amount of SPA on Arbitrum. (Note that the website may show that you will receive wSPA, but be assured that you will receive SPA on Arbitrum. You can verify that using SPA Arbitrum's token address: 0x5575552988A3A80504bBaeB1311674fCFd40aD4B)
5. Click on 'Move funds to Arbitrum One' and then send the transaction to give permission to transfer the capped amount of wSPA.
6. Send the transaction now to bridge and wait for some time for the transcation to be completed successfully.
7. You can track the transaction status/history on the bridge page. In some time, you should see the SPA tokens on Arbitrum in your wallet.

{% embed url="<https://www.youtube.com/watch?v=WNSmyEXbJ_0>" %}

