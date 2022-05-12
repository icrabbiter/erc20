const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { ecsign } = require("ethereumjs-util");

const {
  defaultAbiCoder,
  keccak256,
  toUtf8Bytes,
  solidityPack,
  parseUnits,
  hexlify,
} = ethers.utils;

const getDomainSeparator = (hotToken) => {
  const DOMAIN_SEPARATOR_TYPEHASH = keccak256(
    toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    )
  );
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        DOMAIN_SEPARATOR_TYPEHASH,
        keccak256(toUtf8Bytes("HotERC20")),
        keccak256(toUtf8Bytes("1")),
        ethers.provider.network.chainId,
        hotToken.address,
      ]
    )
  );
};

const getEmergencyWithdrawSeparator = (owner, deadline) => {
  const EMERGENCY_WITHDRAW_TYPEHASH = keccak256(
    toUtf8Bytes("EmergencyWithdraw(address owner,uint256 deadline)")
  );
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [EMERGENCY_WITHDRAW_TYPEHASH, owner.address, deadline]
    )
  );
};

const getCurrentTimestamp = async () => {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
};

describe("HotERC20", () => {
  let deployer, owner, alice, bob;
  let hotToken;

  before(async () => {
    owner = ethers.Wallet.createRandom().connect(ethers.provider);
    alice = ethers.Wallet.createRandom().connect(ethers.provider);
    bob = ethers.Wallet.createRandom().connect(ethers.provider);
    [deployer] = await ethers.getSigners();

    // transfer 100 ETH to owner address
    await deployer.sendTransaction({
      to: owner.address,
      value: parseUnits("100"),
    });
    // transfer 100 ETH to alice address
    await deployer.sendTransaction({
      to: alice.address,
      value: parseUnits("100"),
    });
    // transfer 100 ETH to bob address
    await deployer.sendTransaction({
      to: bob.address,
      value: parseUnits("100"),
    });

    await deployments.fixture("HotERC20");
    hotToken = await ethers.getContract("HotERC20");

    // transfer 1K token to owner
    await hotToken.transfer(owner.address, parseUnits("1000"));
  });

  it("check DOMAIN_SEPARATOR", async () => {
    expect(await hotToken.DOMAIN_SEPARATOR()).to.equal(
      getDomainSeparator(hotToken)
    );
  });

  it("owner set emergency withdraw address to alice", async () => {
    // bob's emergency address = owner
    await hotToken.connect(bob).setEmergencyWithdrawAddress(owner.address);
    expect(await hotToken.emergencyWithdrawAddresses(bob.address)).to.equal(
      owner.address
    );

    // owner's emergency address = alice
    await hotToken.connect(owner).setEmergencyWithdrawAddress(alice.address);
    expect(await hotToken.emergencyWithdrawAddresses(owner.address)).to.equal(
      alice.address
    );
  });

  it("check expired signature for emergency withdraw", async () => {
    await expect(
      hotToken.emergencyWithdraw(
        owner.address,
        (await getCurrentTimestamp()) - 1,
        0,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      )
    ).to.revertedWith("HotERC20: expired signature");
  });

  it("check invalid signature for emergency withdraw", async () => {
    const deadline = (await getCurrentTimestamp()) + 1;

    const digest = keccak256(
      solidityPack(
        ["bytes1", "bytes1", "bytes32", "bytes32"],
        [
          "0x19",
          "0x01",
          getDomainSeparator(hotToken),
          getEmergencyWithdrawSeparator(owner, deadline),
        ]
      )
    );

    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );

    await expect(
      hotToken.emergencyWithdraw(
        owner.address,
        deadline + 1,
        v,
        hexlify(r),
        hexlify(s)
      )
    ).to.revertedWith("HotERC20: invalid signature");
    await expect(
      hotToken.emergencyWithdraw(
        alice.address,
        deadline + 1,
        v,
        hexlify(r),
        hexlify(s)
      )
    ).to.revertedWith("HotERC20: invalid signature");
  });

  it("bob calls emergency withdraw for owner", async () => {
    const deadline = (await getCurrentTimestamp()) + 1;

    const digest = keccak256(
      solidityPack(
        ["bytes1", "bytes1", "bytes32", "bytes32"],
        [
          "0x19",
          "0x01",
          getDomainSeparator(hotToken),
          getEmergencyWithdrawSeparator(owner, deadline),
        ]
      )
    );

    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );

    await hotToken
      .connect(bob)
      .emergencyWithdraw(owner.address, deadline, v, hexlify(r), hexlify(s));

    expect(await hotToken.balanceOf(alice.address)).to.equal(
      parseUnits("1000")
    );
    expect(await hotToken.isBlacklisted(owner.address)).to.equal(true);
  });

  it("check blacklisted address when register emergency withdraw address", async () => {
    await expect(
      hotToken.connect(owner).setEmergencyWithdrawAddress(bob.address)
    ).to.revertedWith("HotERC20: blacklisted");
    await expect(
      hotToken.connect(alice).setEmergencyWithdrawAddress(owner.address)
    ).to.revertedWith("HotERC20: blacklisted");
  });

  it("check blacklisted address when emergency withdraw", async () => {
    await expect(
      hotToken
        .connect(bob)
        .emergencyWithdraw(
          owner.address,
          (await getCurrentTimestamp()) - 1,
          0,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        )
    ).to.revertedWith("HotERC20: blacklisted");
  });

  it("if recipient is blacklisted, transfer tokens to emergency withdraw address", async () => {
    // transfer 1K to owner
    await hotToken.transfer(owner.address, parseUnits("1000"));

    // alice will receive 1K not owner
    expect(await hotToken.balanceOf(alice.address)).to.equal(
      parseUnits("2000")
    );
    expect(await hotToken.balanceOf(owner.address)).to.equal(0);
  });

  it("bob emergency withdraw: bob's emergency address is owner (which is blacklisted already)", async () => {
    // transfer 1K to alice
    await hotToken.transfer(alice.address, parseUnits("1000"));
    // transfer 1K to bob
    await hotToken.transfer(bob.address, parseUnits("1000"));

    // bob emergency withdraw
    const deadline = (await getCurrentTimestamp()) + 1;

    const digest = keccak256(
      solidityPack(
        ["bytes1", "bytes1", "bytes32", "bytes32"],
        [
          "0x19",
          "0x01",
          getDomainSeparator(hotToken),
          getEmergencyWithdrawSeparator(bob, deadline),
        ]
      )
    );

    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(bob.privateKey.slice(2), "hex")
    );

    // try to emergency withdraw 1K from bob
    // bob's emergency address is owner
    // owner's emergency address is alice, so alice will receive 1K
    await hotToken.emergencyWithdraw(
      bob.address,
      deadline,
      v,
      hexlify(r),
      hexlify(s)
    );
  });
});
