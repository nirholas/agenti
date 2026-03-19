#include "../config/ConfigLoader.h"
#include <boost/test/unit_test.hpp>
#include <map>
#include <string>

#include "MachinePalApp.h"
#include "config/ConfigManager.h"
#include "config/subconfigs/FacilitatorConfig.h"
#include "config/subconfigs/NetworkConfig.h"
#include "config/subconfigs/ServerConfig.h"
#include "nlohmann/json.hpp"

ptr<MachinePalApp> startApp(std::map<std::string, std::string>& configMap );

BOOST_AUTO_TEST_CASE( deserialize_basic_proxy_config ) {
    // Path to the test config file
    std::map< std::string, std::string > configMap = { { "CONFIG",
        "src/tests/configs/basic/machinepal.yml" } };

    auto app = startApp( configMap );


    auto config = app->configManager()->latestConfig();

    BOOST_TEST( config->server()->http() );  // Check frontend
    BOOST_TEST( config->server()->http()->port() == 8080 );
    BOOST_TEST( config->server()->https()->port() == 8443 );


    BOOST_TEST( config->server()->https()->certFile().string().ends_with(
        "certs/insecure_test_localhost.crt" ) );
    BOOST_TEST( config->server()->https()->keyFile().string().ends_with(
        "secrets/insecure_test_localhost.key" ) );
    //  BOOST_TEST(config->server()->https()->keyPassFile() == "secrets/key_password");
    //    BOOST_TEST(config->server()->https()->caFile().has_value());
    //    BOOST_TEST(config->server()->https()->caFile().value() == "certs/ca.crt");

    // Check facilitator
    BOOST_TEST(!config->network()->facilitator()); // No facilitator in this config
    /*
    BOOST_TEST( config->network()->facilitator()->baseUrl() == "https://api.coinbase.com/v2" );
    BOOST_TEST( config->network()->facilitator()->apiKeyFile().has_value() );
    BOOST_TEST( config->network()->facilitator()->apiKeyFile().value().string().ends_with(

        "secrets/coinbase_api_key.txt" )
        );
    */

}

ptr< MachinePalApp > startApp( std::map< std::string, std::string >& configMap ) {
    try {
        return MachinePalApp::makeInstance( configMap );
    } catch ( const std::exception& ex ) {
        printNestedException( ex );
        BOOST_FAIL( "Exception:" );
    }
    return nullptr;
}
