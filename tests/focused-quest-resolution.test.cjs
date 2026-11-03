const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolve } = require('metro-resolver');
const { getDefaultConfig } = require('expo/metro-config');
const sourceExts = getDefaultConfig(path.resolve('App')).resolver.sourceExts;
for (const platform of ['ios', 'android', 'web']) {
  test(`${platform} resolves the correct quest-start coordinator`, () => {
    const context = {
      originModulePath: path.resolve('App/contexts/QuestEngineContext.tsx'),
      sourceExts,
      assetExts: new Set(),
      preferNativePlatform: platform !== 'web',
      mainFields: [],
      getPackageForModule: () => null,
      getPackage: () => null,
      resolveAsset: () => null,
      fileSystemLookup: file => {
        if (!fs.existsSync(file)) return { exists: false };
        return { exists: true, type: fs.statSync(file).isDirectory() ? 'd' : 'f', realPath: fs.realpathSync(file) };
      },
    };
    const result = resolve(context, '../hooks/use-focused-quest-start', platform);
    assert.equal(result.filePath, path.resolve(`App/hooks/use-focused-quest-start${platform === 'web' ? '' : platform === 'ios' ? '.ios' : '.native'}.tsx`));
  });
}
