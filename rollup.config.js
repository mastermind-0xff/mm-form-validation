import typescript from '@rollup/plugin-typescript';

const typescriptPlugin = () =>
  typescript({
    tsconfig: './tsconfig.build.json',
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    outDir: undefined,
  });

// no dependencies: the core runs in browsers and in Node as it is. Four
// entries, also in package.json "exports": the core, the browser binding, the
// test helpers and the CSS generator
const input = [
  'src/index.ts',
  'src/dom/index.ts',
  'src/testing/index.ts',
  'src/css/index.ts',
];

export default [
  {
    input,
    plugins: [typescriptPlugin()],
    output: {
      dir: 'dist/esm',
      format: 'esm',
      entryFileNames: '[name].js',
      // one file per module: bundlers keep only the field types a form uses
      preserveModules: true,
      preserveModulesRoot: 'src',
      sourcemap: true,
    },
  },
  {
    input,
    plugins: [typescriptPlugin()],
    output: {
      // `.cjs`: the package is `"type": "module"`, so `.js` files would be
      // loaded as ESM by `require`
      dir: 'dist/cjs',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      exports: 'named',
      sourcemap: true,
    },
  },
];
