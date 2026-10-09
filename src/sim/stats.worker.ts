// Off-main-thread analysis of genetic & acoustic diversity.
export interface StatsRequest {
  genomes: number[][];
  voice: [number, number, number, number][]; // spectral, noise, harmonicity, rhythmDiv
  geneCount: number;
}
export interface StatsResult {
  geneStd: number[];
  meanPairwise: number;
  sonicIndex: number;
  spectralHist: number[];
  textureHist: number[];
  n: number;
}

self.onmessage = (e: MessageEvent<StatsRequest>) => {
  const { genomes, voice, geneCount } = e.data;
  const n = genomes.length;
  const mean = new Array(geneCount).fill(0);
  const std = new Array(geneCount).fill(0);
  for (const g of genomes) for (let i = 0; i < geneCount; i++) mean[i] += g[i] / Math.max(1, n);
  for (const g of genomes) for (let i = 0; i < geneCount; i++) std[i] += (g[i] - mean[i]) ** 2 / Math.max(1, n);
  for (let i = 0; i < geneCount; i++) std[i] = Math.sqrt(std[i]);
  // sampled pairwise distance
  let pd = 0, pc = 0;
  const samples = Math.min(1500, (n * (n - 1)) / 2);
  for (let s = 0; s < samples; s++) {
    const a = genomes[Math.floor(Math.random() * n)];
    const b = genomes[Math.floor(Math.random() * n)];
    if (a === b) continue;
    let d = 0;
    for (let i = 0; i < geneCount; i++) d += Math.abs(a[i] - b[i]);
    pd += d / geneCount;
    pc++;
  }
  // sonic biodiversity: Shannon entropy over a 4-D acoustic trait lattice
  const bins = new Map<string, number>();
  const spectralHist = new Array(16).fill(0);
  const textureHist = new Array(8).fill(0);
  for (const v of voice) {
    const key = `${Math.floor(v[0] * 6)}|${Math.floor(v[1] * 3)}|${Math.floor(v[2] * 3)}|${v[3]}`;
    bins.set(key, (bins.get(key) || 0) + 1);
    spectralHist[Math.min(15, Math.floor(v[0] * 16))]++;
    textureHist[Math.min(7, Math.floor(v[1] * 8))]++;
  }
  let H = 0;
  for (const c of bins.values()) { const p = c / Math.max(1, n); H -= p * Math.log(p); }
  const res: StatsResult = { geneStd: std, meanPairwise: pc ? pd / pc : 0, sonicIndex: H, spectralHist, textureHist, n };
  (self as unknown as Worker).postMessage(res);
};
