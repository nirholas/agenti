namespace x402.Core.Tests;

using x402.Core;

public class AssetInfoProviderTests
{

    [Test]
    public void ContractsAreUnique()
    {
        // Arrange
        var provider = new AssetInfoProvider();

        // Act
        var contracts = provider.GetAll().Select(a => a.ContractAddress).ToList();

        // Assert
        Assert.That(contracts.Distinct(StringComparer.OrdinalIgnoreCase).Count(), Is.EqualTo(contracts.Count), "All contract addresses should be unique (case-insensitive).");
    }
}
