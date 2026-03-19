using x402.Core.Models;

namespace x402.Core.Interfaces
{
    public interface IAssetInfoProvider
    {
        /// <summary>
        /// Retrieves information about a digital asset associated with the specified contract address.
        /// </summary>
        /// <param name="contractAddress">The contract address of the asset to retrieve information for. Cannot be null or empty.</param>
        /// <returns>An AssetInfo object containing details about the asset if found; otherwise, null.</returns>
        AssetInfo? GetAssetInfo(string contractAddress);

        /// <summary>
        /// Retrieves asset information associated with the specified network.
        /// </summary>
        /// <param name="network">The name of the network for which to obtain asset information. Cannot be null or empty.</param>
        /// <returns>An <see cref="AssetInfo"/> object containing details about the asset for the specified network, or <see
        List<AssetInfo> GetAssetInfoByNetwork(string network);

        /// <summary>
        /// Add custom asset info.
        /// </summary>
        /// <param name="assetInfo"></param>
        void AddAssetInfo(AssetInfo assetInfo);

        /// <summary>
        /// Alias that points to a contract address.
        /// </summary>
        /// <param name="alias"></param>
        /// <param name="contractAddress"></param>
        void AddAlias(string alias, string contractAddress);

        /// <summary>
        /// Retrieves a list containing information about all available assets.
        /// </summary>
        /// <returns>A list of <see cref="AssetInfo"/> objects representing all assets. The list will be empty if no assets are
        /// available.</returns>
        List<AssetInfo> GetAll();
    }
}
