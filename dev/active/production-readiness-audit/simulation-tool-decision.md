# Simulation Tool Decision

Updated decision on SimulationToolbar:

SimulationToolbar is a QA/testing tool used to help validate the site and find errors. It is not intended to remain as a normal end-user feature long-term.

Please treat it as:
- testing-only
- hidden/disabled outside the appropriate testing environment
- not a product contradiction if gated from production users

Also update the audit/docs accordingly:
- do not treat SimulationToolbar as a permanent user-facing feature
- revise any product docs that currently describe it as part of the normal end-user experience
- keep note that it may be removed/disabled/hidden once site validation is complete
