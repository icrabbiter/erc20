const deployBase = async (hre) => {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  if (deployer) {
    await deploy("HotERC20", {
      from: deployer,
      args: [ethers.utils.parseUnits("1000000")],
      log: true,
    });
  } else {
    await deploy("HotERC20", {
      from: (await ethers.getSigners())[0].address,
      args: [ethers.utils.parseUnits("1000000")],
      log: true,
    });
  }
};

deployBase.tags = ["HotERC20"];

module.exports = deployBase;
