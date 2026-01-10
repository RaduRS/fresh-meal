declare module "next-pwa" {
  type NextPwaInit = (options: unknown) => (nextConfig: unknown) => unknown;
  const init: NextPwaInit;
  export default init;
}

