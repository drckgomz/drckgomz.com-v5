// Fixture-only Next router replacement. Never imported by application routes.
export const useRouter = () => ({ push: (path: string) => { window.location.href = path; }, refresh: () => {}, back: () => window.history.back() });
