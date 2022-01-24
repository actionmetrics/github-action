import { getInput, setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";

async function main() {
  try {
    const token = getInput("github_token", { required: true });
    const workflow = getInput("workflow", { required: true });
    const [owner, repo] = getInput("repo", { required: true }).split("/");
    const path = getInput("path", { required: true });
    const name = getInput("name");
    const branch = getInput("default_branch");

    let runID;

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
        console.log(run.id);
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

        runID = run.id;
        break;
      }

      if (runID) {
        break;
      }
    }

    if (runID) {
      console.log("==> RunID:", runID);
    } else {
      throw new Error("no matching workflow run found");
    }
  } catch (error) {
    setFailed(error);
  }
}

main();
