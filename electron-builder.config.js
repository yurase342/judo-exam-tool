export default {
  appId: 'com.nationalexamstudytool',
  productName: '国家試験対策ツール',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'package.json',
  ],
  mac: {
    category: 'public.app-category.education',
    target: 'dmg',
  },
  win: {
    target: 'nsis',
  },
  linux: {
    target: 'AppImage',
  },
};
