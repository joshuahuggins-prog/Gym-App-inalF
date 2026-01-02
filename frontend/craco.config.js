module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Remove ForkTsCheckerWebpackPlugin to avoid AJV/schema-utils keyword conflicts in CI
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor && plugin.constructor.name !== "ForkTsCheckerWebpackPlugin"
      );
      return webpackConfig;
    },
  },
};
