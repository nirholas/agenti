# Contribute to LibertAI Agents

Everyone is welcome to contribute, and we value everybody's contribution. Code
contributions are not the only way to help the community. Answering questions, helping
others, and improving the documentation are also immensely valuable.

It also helps us if you spread the word! Reference the framework in blog posts
about the awesome projects it made possible, shout out on Twitter every time it has
helped you, or simply ⭐️ the repository to say thank you.

**This guide was heavily inspired by the awesome [transformers guide to contributing](https://github.com/huggingface/transformers/blob/main/CONTRIBUTING.md).**

## Ways to contribute

There are several ways you can contribute to LibertAI Agents:

* Fix outstanding issues with the existing code.
* Submit issues related to bugs or desired new features.
* Implement new model architectures.
* Contribute to the examples or to the documentation.

If you don't know where to start, there is a special [Good First
Issue](https://github.com/Libertai/libertai-agents/contribute) listing. It will give you a list of
open issues that are beginner-friendly and help you start contributing to open-source. The best way to do that is to open a Pull Request and link it to the issue that you'd like to work on. We try to give priority to opened PRs as we can easily track the progress of the fix, and if the contributor does not have time anymore, someone else can take the PR over.

> All contributions are equally valuable to the community. 🥰

## Fixing outstanding issues

If you notice an issue with the existing code and have a fix in mind, feel free to [start contributing](#create-a-pull-request) and open a Pull Request!

## Submitting a bug-related issue or feature request

Do your best to follow these guidelines when submitting a bug-related issue or a feature
request. It will make it easier for us to come back to you quickly and with good
feedback.

### Did you find a bug?

The LibertAI Agents framework is robust and reliable thanks to users who report the problems they encounter.

Before you report an issue, we would really appreciate it if you could **make sure the bug was not
already reported** (use the search bar on GitHub under Issues). Your issue should also be related to bugs in the framework itself, and not your code. If you're unsure whether the bug is in your code or the library, please ask in our [Telegram](https://t.me/libertai) first. This helps us respond quicker to fixing issues related to the framework versus general questions.

Once you've confirmed the bug hasn't already been reported, please include the following information in your issue so we can quickly resolve it:

* Your **OS type and version** and **Python** version when applicable.
* A short, self-contained, code snippet that allows us to reproduce the bug in
  less than 30s.
* The *full* traceback if an exception is raised.
* Attach any other additional information, like screenshots, you think may help.

### Do you want a new feature?

If there is a new feature you'd like to see in LibertAI Agents, please open an issue and describe:

1. What is the *motivation* behind this feature? Is it related to a problem or frustration with the framework? Is it a feature related to something you need for a project? Is it something you worked on and think it could benefit the community?

   Whatever it is, we'd love to hear about it!

2. Describe your requested feature in as much detail as possible. The more you can tell us about it, the better we'll be able to help you.
3. Provide a *code snippet* that demonstrates the features usage.

If your issue is well written we're already 80% of the way there by the time you create it.

## Do you want to implement a new model?

New models are constantly released and if you want to implement a new model, please provide the following information:

* A short description of the model and a link to the paper.
* Link to the implementation if it is open-sourced.
* Link to the model weights if they are available.

If you are willing to contribute the model yourself, let us know so we can help you add it to LibertAI!

## Do you want to add documentation?

We're always looking for improvements to the documentation that make it more clear and accurate. Please let us know how the documentation can be improved such as typos and any content that is missing, unclear or inaccurate. We'll be happy to make the changes or help you make a contribution if you're interested!

## Create a Pull Request

Before writing any code, we strongly advise you to search through the existing PRs or
issues to make sure nobody is already working on the same thing. If you are
unsure, it is always a good idea to open an issue to get some feedback.

You will need basic `git` proficiency to contribute to
LibertAI Agents. While `git` is not the easiest tool to use, it has the greatest
manual. Type `git --help` in a shell and enjoy! If you prefer books, [Pro
Git](https://git-scm.com/book/en/v2) is a very good reference.

You'll need **[Python 3.10](https://github.com/Libertai/libertai-agents/blob/main/libertai_agents/pyproject.toml#L19)** or above to contribute to LibertAI Agents. Follow the steps below to start contributing:

1. Fork the [repository](https://github.com/Libertai/libertai-agents) by
   clicking on the **[Fork](https://github.com/Libertai/libertai-agents/fork)** button on the repository's page. This creates a copy of the code
   under your GitHub user account.

2. Clone your fork to your local disk, and add the base repository as a remote:

   ```bash
   git clone git@github.com:<your Github handle>/libertai-agents.git
   cd libertai-agents
   git remote add upstream https://github.com/Libertai/libertai-agents.git
   ```

3. Create a new branch to hold your development changes:

   ```bash
   git checkout -b a-descriptive-name-for-my-changes
   ```

   🚨 **Do not** work on the `main` branch!

4. Set up a development environment by running the following command in a virtual environment:

   ```bash
   poetry install --all-extras
   ```

   Depending on your OS, and since the number of optional dependencies of libertai-agents is growing, you might get a
   failure with this command. If that's the case make sure to install the ones you are working with + the dev dependencies.

5. Develop the features in your branch.

   As you work on your code, you should make sure the test suite
   passes. Run the tests impacted by your changes like this:

   ```bash
   poetry run pytest tests/<TEST_TO_RUN>.py
   ```

   LibertAI relies on `ruff` to format its source code
   consistently. After you make changes, apply automatic style corrections and code verifications with:

   ```bash
   ruff check . --fix
   ```

   Once you're happy with your changes, add the changed files with `git add` and
   record your changes locally with `git commit`:

   ```bash
   git add modified_file.py
   git commit
   ```

   Please remember to write [good commit messages](https://chris.beams.io/posts/git-commit/) to clearly communicate the changes you made!

   To keep your copy of the code up to date with the original
   repository, rebase your branch on `upstream/branch` *before* you open a pull request or if requested by a maintainer:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

   Push your changes to your branch:

   ```bash
   git push -u origin a-descriptive-name-for-my-changes
   ```

   If you've already opened a pull request, you'll need to force push with the `--force` flag. Otherwise, if the pull request hasn't been opened yet, you can just push your changes normally.

6. Now you can go to your fork of the repository on GitHub and click on **Pull Request** to open a pull request. Make sure you tick off all the boxes on our [checklist](#pull-request-checklist) below. When you're ready, you can send your changes to the project maintainers for review.

7. It's ok if maintainers request changes, it happens to our core contributors
   too! So everyone can see the changes in the pull request, work in your local
   branch and push the changes to your fork. They will automatically appear in
   the pull request.

### Pull request checklist

☐ The pull request title should summarize your contribution.<br>
☐ If your pull request addresses an issue, please mention the issue number in the pull
request description to make sure they are linked (and people viewing the issue know you
are working on it).<br>
☐ To indicate a work in progress please prefix the title with `[WIP]`. These are
useful to avoid duplicated work, and to differentiate it from PRs ready to be merged.<br>
☐ Make sure existing tests pass.<br>
☐ If adding a new feature, also add tests for it.<br>
☐ All public methods must have informative docstrings.<br>

### Tests

An extensive test suite is included to test the framework behavior and several examples. Tests can be found in
the [tests](https://github.com/Libertai/libertai-agents/tree/main/libertai_agents/tests) folder.

From the root of the repository, specify a *path to a subfolder or a test file* to run the test:

```bash
poetry run pytest
```

You can also specify a smaller set of tests in order to test only the feature
you're working on.

### Develop on Windows

On Windows (unless you're working in [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/) or WSL), you need to configure git to transform Windows `CRLF` line endings to Linux `LF` line endings:

```bash
git config core.autocrlf input
```
