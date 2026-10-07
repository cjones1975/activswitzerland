import 'colors';

let warnedMissingDevKey = false;

// Production uses MYS_KEY; every other environment uses MYS_DEV_KEY, so local
// development and testing draw on their own MySwitzerland quota instead of
// production's. Falls back to MYS_KEY (with a one-time warning) if a dev
// environment hasn't set MYS_DEV_KEY yet, rather than failing every request.
export const mysApiKey = () => {
  if (process.env.NODE_ENV === 'production') return process.env.MYS_KEY;
  if (process.env.MYS_DEV_KEY) return process.env.MYS_DEV_KEY;

  if (!warnedMissingDevKey) {
    warnedMissingDevKey = true;
    console.warn('MYS_DEV_KEY is not set — falling back to MYS_KEY for MySwitzerland calls'.yellow);
  }
  return process.env.MYS_KEY;
};
