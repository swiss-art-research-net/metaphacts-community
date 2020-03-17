# Contributing to the metaphacts platform

## Types of contributions

Contributions can take different forms:
* documentation
* source code for features or bug fixes
* examples and show cases

Additionally, everybody might help the community with one or more of these activities:
* testing
* bug reports
* helping others in answering questions

## Contributor License Agreement (CLA)

Any type of contribution requires a Contributor License Agreement (CLA). Please get in contact with metaphacts for details and the template of the agreement.

## Community Collaboration Process

1. Prerequisite: **sign the Contribution License Agreement (CLA)** (both for individual contributors as well as the organization a contributor is affiliated with)

2. **Discuss** the planned contribution upfront with the community and (especially for changes to the platform) metaphacts

3. Clone the **public repository** platform repository

4. **Clarify Intellectual Property** / ownership: IP and ownership are transferred to metaphacts for platform code

5. **Implement** your changes

6. Run the **build and unit tests** to avoid regressions

7. Ensure that changes follow the **Contribution Acceptance Criteria**

8. Create a **Pull Request** (PR) for the repository based on the current `development` branch (not `master`!)

9. Address **review comments** to get the PR into a state where it is accepted

## Contribution Acceptance Criteria

All contributions and pull requests (PR) should meet the following acceptance criteria:

* Contain functionality other platform users will benefit from
* Should not add mandatory configuration options or change existing configuration options. If this is not true, extensive justification should be provided for making such changes.
* If the PR includes non-backward compatible changes to existing components, justifications must be provided along with the migration guide for existing users
* The PR is as small as possible
* Only one specific issue is fixed or one specific feature is added
* Includes obvious unit tests and they are passing
* Follows common code styles for the platform
* Contains a small number of logically organized commits
* The changes can be merged without conflicts
* If the PR adds dependencies to any new libraries, they (including all transitive dependencies!) should conform to the list of approved licences (MIT, EPL, LGPL v2 and v3, Apache 2.0 License, BSD 2-clause and 3- clause)
