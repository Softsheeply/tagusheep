export async function runCaptureTransaction<TFile, TUploaded, TResult>(options: {
  files: TFile[];
  upload: (file: TFile, index: number) => Promise<TUploaded>;
  persist: (uploaded: TUploaded[]) => Promise<TResult>;
  rollback: (uploaded: TUploaded) => Promise<unknown>;
}) {
  const uploaded: TUploaded[] = [];
  try {
    for (let index = 0; index < options.files.length; index++) {
      uploaded.push(await options.upload(options.files[index], index));
    }
    return await options.persist(uploaded);
  } catch (error) {
    await Promise.allSettled([...uploaded].reverse().map(options.rollback));
    throw error;
  }
}
