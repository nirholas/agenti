# Development ==========================================================================================================
run_install:
    mvn install -DskipTests

run_tests:
    mvn clean install

run_integration_tests:
    mvn verify -Pintegration-tests

# Release ==============================================================================================================
run_deploy_snapshot:
    mvn -B -Prelease clean deploy

start_release:
    git remote set-url origin git@github.com:mogami-tech/x402-spring-boot-starter.git
    git checkout development
    git pull
    git status
    mvn gitflow:release-start

finish_release:
    mvn gitflow:release-finish -DskipTests

run_deploy_release:
    mvn -B -Prelease deploy -DskipTests
