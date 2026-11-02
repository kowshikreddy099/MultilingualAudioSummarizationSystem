import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // The package offers separate Node and browser bundles. Next's server-side
    // analysis of a client component otherwise resolves the Node bundle and
    // cannot include its native-only ONNX assets.
    config.resolve.alias['@huggingface/transformers$'] = path.resolve(
      process.cwd(),
      'node_modules/@huggingface/transformers/dist/transformers.web.js'
    );
    // The package's ESM entry uses import.meta and makes Next 14's minifier
    // treat the ONNX asset as a script. Its browser UMD bundle exports the
    // same API and keeps the reliable WASM execution path.
    config.resolve.alias['onnxruntime-web$'] = path.resolve(
      process.cwd(),
      'node_modules/onnxruntime-web/dist/ort.min.js'
    );
    return config;
  },
};

export default nextConfig;
