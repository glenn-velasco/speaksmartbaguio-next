export function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(...args);
  }
}

export function devError(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.error(...args);
  }
}
