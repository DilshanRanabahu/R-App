module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    // AGENTS.md §8.9: no console output in release builds.
    plugins: isProduction ? ['transform-remove-console'] : [],
  };
};
