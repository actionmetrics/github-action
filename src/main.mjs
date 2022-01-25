import { getInput, setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";
import pathname from "path";
import unzip from "adm-zip";
import filesize from "filesize";
import fs from "fs";

async function main() {
  try {
    const token = getInput("github_token", { required: true });
    const workflow = getInput("workflow", { required: true });
    const [owner, repo] = getInput("repo", { required: true }).split("/");
    const path = getInput("path", { required: true });
    const name = getInput("name");
    const branch = getInput("default_branch");

    let runId;

    const client = getOctokit(token);

    for await (const runs of client.paginate.iterator(
      client.rest.actions.listWorkflowRuns,
      {
        owner: owner,
        repo: repo,
        workflow_id: workflow,
        branch: branch,
      }
    )) {
      for (const run of runs.data) {
        let artifacts = await client.rest.actions.listWorkflowRunArtifacts({
          owner: owner,
          repo: repo,
          run_id: run.id,
        });

        if (artifacts.data.artifacts.length == 0) {
          continue;
        }

        const artifact = artifacts.data.artifacts.find((artifact) => {
          return artifact.name == name;
        });

        if (!artifact) {
          continue;
        }

        runId = run.id;
        break;
      }

      if (runId) {
        break;
      }
    }

    if (runId) {
      console.log(`*** Found run ***: ${runId}`);
    } else {
      throw new Error("*** no matching workflow run found ***");
    }

    let artifacts = await client.paginate(
      client.actions.listWorkflowRunArtifacts,
      {
        owner: owner,
        repo: repo,
        run_id: runID,
      }
    );

    const [artifact] = artifacts.filter((artifact) => {
      return artifact.name == name;
    });

    console.log("==> Artifact:", artifact.id);

    const size = filesize(artifact.size_in_bytes, { base: 10 });

    console.log(`==> Downloading: ${artifact.name}.zip (${size})`);

    const zip = await client.actions.downloadArtifact({
      owner: owner,
      repo: repo,
      artifact_id: artifact.id,
      archive_format: "zip",
    });

    const dir = name ? path : pathname.join(path, artifact.name);

    fs.mkdirSync(dir, { recursive: true });

    const adm = new unzip(Buffer.from(zip.data));

    adm.getEntries().forEach((entry) => {
      const action = entry.isDirectory ? "creating" : "inflating";
      const filepath = pathname.join(dir, entry.entryName);

      console.log(`  ${action}: ${filepath}`);
    });

    adm.extractAllTo(dir, true);
  } catch (error) {
    setFailed(error);
  }
}

main();
