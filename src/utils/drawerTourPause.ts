const pendingPauses = new Map<number, (finished: boolean) => void>();
let nextRequestId = -1;

export const requestDrawerTourPause = () => {
  // Negative IDs keep these requests separate from tab presses, which use Date.now().
  const requestId = nextRequestId--;
  let timer: ReturnType<typeof setTimeout>;
  const completed = new Promise<boolean>((resolve) => {
    const finish = (finished: boolean) => {
      clearTimeout(timer);
      pendingPauses.delete(requestId);
      resolve(finished);
    };
    pendingPauses.set(requestId, finish);
    timer = setTimeout(() => finish(false), 15000);
  });

  return { requestId, completed };
};

export const finishDrawerTourPause = (requestId: number, finished: boolean) => {
  pendingPauses.get(requestId)?.(finished);
};
