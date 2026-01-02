module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.plugins = (webpackConfig.plugins || []).filter((plugin) => {
        const name = plugin?.constructor?.name || "";
        // Remove Fork TS checker plugin (and any variant)
        return !name.toLowerCase().includes("forktschecker");
      });
      return webpackConfig;
    },
  },
};
