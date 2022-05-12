# ERC20 standard with emergency withdraw feature

** concept is from ERC20Permit contract from openzeppelin

Allow token holders to register a backup address which will be used to transfer tokens to in case of emergency.
Allow token holders to transfer all their tokens to the previously registered emergency addresses via an EIP712 signature:
This solution will use `EmergencyWithdraw(address owner,uint256 deadline)` as the typehash for emergency withdraw signature.
-`owner` represents the token holder who will emergency withdraw to another.
-`deadline` represents the dealine of the signature.

## Install dependencies

```sh
yarn install
```

## Compile contracts

```sh
yarn compile
```

## Run tests

```sh
yarn test
```

## Deploy contracts

```sh
yarn deploy --network hardhat
yarn deploy --network rinkeby
```

## Deployed address on rinkeby

https://rinkeby.etherscan.io/address/0x6b570447f2a3571457528e14aa19704ea97381e4

### example transactions:

- set emergency withdraw address : https://rinkeby.etherscan.io/tx/0x5eb96b72020c1729a0754fcb7181207daa8bec752fb74097e5ebf522fb5f070c
- emergency withdraw : https://rinkeby.etherscan.io/tx/0xc62a4afa5f3ecb45c67f724a3d1d97c8fa409e369509e65bc9b821a80aae1ec1
