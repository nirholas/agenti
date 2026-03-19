#include "MachinePalCommon.h"
#include <boost/test/unit_test.hpp>
#include "admin/ProjectGenerator.h"


#define BOOST_TEST_MODULE ProjectGeneratorTest


namespace fs = std::filesystem;

// A test fixture to manage a temporary directory for tests
struct TestFixture {
    fs::path tempDir;

    TestFixture() {
        // Create a unique temporary directory for each test run
        tempDir = fs::temp_directory_path() / "ProjectGeneratorTest";
        fs::remove_all(tempDir); // Clean up from previous runs if necessary
        fs::create_directories(tempDir);
    }

    ~TestFixture() {
        // Clean up the temporary directory after tests are done
        std::error_code ec;
        fs::remove_all(tempDir, ec);
    }
};

BOOST_FIXTURE_TEST_SUITE(ProjectGeneratorTests, TestFixture)

BOOST_AUTO_TEST_CASE(test_generate_project_success) {
    fs::path projectDir = tempDir / "my_project";
    fs::create_directory(projectDir);

    BOOST_CHECK_NO_THROW(ProjectGenerator::generateProject(projectDir));

    // Verify directory structure
    BOOST_CHECK(fs::is_directory(projectDir / "secrets"));
    BOOST_CHECK(fs::is_directory(projectDir / "certs"));

    // Verify file creation and that they are not empty
    const auto walletPath = projectDir / "secrets" / "machinepal_client_wallet.key";
    BOOST_CHECK(fs::exists(walletPath));
    BOOST_CHECK(fs::file_size(walletPath) > 0);

    const auto certKeyPath = projectDir / "secrets" / "machinepal_tls_certificate.key";
    BOOST_CHECK(fs::exists(certKeyPath));
    BOOST_CHECK(fs::file_size(certKeyPath) > 0);

    const auto certPath = projectDir / "certs" / "machinepal_tls_certificate.crt";
    BOOST_CHECK(fs::exists(certPath));
    BOOST_CHECK(fs::file_size(certPath) > 0);

    const auto configPath = projectDir / "machinepal.yml";
    BOOST_CHECK(fs::exists(configPath));
    BOOST_CHECK(fs::file_size(configPath) > 0);
}

BOOST_AUTO_TEST_CASE(test_generate_project_non_existent_dir) {
    fs::path projectDir = tempDir / "non_existent";
    BOOST_CHECK_THROW(ProjectGenerator::generateProject(projectDir), std::runtime_error);
}

BOOST_AUTO_TEST_CASE(test_generate_project_not_a_directory) {
    fs::path projectFile = tempDir / "not_a_dir.txt";
    {
        std::ofstream ofs(projectFile);
        ofs << "I am a file.";
    }
    BOOST_CHECK_THROW(ProjectGenerator::generateProject(projectFile), std::runtime_error);
}

BOOST_AUTO_TEST_CASE(test_generate_project_non_empty_dir) {
    fs::path projectDir = tempDir / "not_empty";
    fs::create_directory(projectDir);
    {
        std::ofstream ofs(projectDir / "some_file.txt");
        ofs << "This directory is not empty.";
    }
    BOOST_CHECK_THROW(ProjectGenerator::generateProject(projectDir), std::runtime_error);
}

BOOST_AUTO_TEST_SUITE_END()
