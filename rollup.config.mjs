import nodeResolve from "@rollup/plugin-node-resolve"
import commonjs from '@rollup/plugin-commonjs';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import del from 'rollup-plugin-delete'
import typescript from '@rollup/plugin-typescript';

export default {
  input: "./src/js/editor.ts",
  inlineDynamicImports: true,
  output: {
    name: "MarkdownEditor",
    file: "./dist/editor.js",
  },
  plugins: [
    typescript(),
    del({ targets: 'dist/*' }),
    nodeResolve({ browser: true }),
    commonjs({
      include: /node_modules/,
    }),
    babel({
      babelrc: true,
      exclude: 'node_modules/**'
    }),
    terser(),
  ]
}