const core = require("@actions/core");
const github = require("@actions/github");

async function main() {
  try {
    const token = core.getInput("github_token", { required: true });
    const workflow = core.getInput("workflow", { required: true });
    const [owner, repo] = core.getInput("repo", { required: true }).split("/");
    const path = core.getInput("path", { required: true });
    const name = core.getInput("name");
    const branch = core.getInput("default_branch");

    let runID;

    const client = github.getOctokit(token);

    for await (const runs of client.paginate.iterator(
      client.actions.listWorkflowRuns,
      {
        owner: owner,
        repo: repo,
        workflow_id: workflow,
        branch: branch,
      }
    )) {
      for (const run of runs.data) {
        let artifacts = await client.actions.listWorkflowRunArtifacts({
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
    core.setFailed(error.message);
  }
}

main();
