import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { getArchiveStats } from "@/lib/db";
import { buildCliAIArgs } from "@/lib/aiConfig";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const minClusterSize = body.min_cluster_size;
    const nClusters = body.n_clusters;

    const projectRoot = path.resolve(process.cwd(), "..");
    const aiArgs = buildCliAIArgs();
    const args = ["run", "epub-archive", ...aiArgs, "cluster"];

    if (minClusterSize) {
      args.push("--min-cluster-size", String(minClusterSize));
    }
    if (nClusters) {
      args.push("--n-clusters", String(nClusters));
    }

    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn("uv", args, {
        cwd: projectRoot,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `El comando de clustering falló con código ${code}`));
        }
      });
    });

    const stats = getArchiveStats();

    return NextResponse.json({
      success: true,
      rawOutput: output,
      clusters: stats.clusters,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
