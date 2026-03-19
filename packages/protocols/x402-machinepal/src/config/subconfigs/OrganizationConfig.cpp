#include "OrganizationConfig.h"

#include "PassThroughConfig.h"
#include "config/JsonUtils.h"
#include "exceptions/JsonValidationException.h"


ptr<PassThroughConfig> OrganizationConfig::passThroughConfig() const {
    return passThroughConfig_;
}

void OrganizationConfig::validateOrgName(const std::string &name) {
    // Rule 1: Length must be between 1 and 39 characters
    if (name.empty() || name.size() > 39) {
        throw JsonValidationException(
            "Invalid organization name: " + name + ". It must be between 1 and 39 characters.",
            nlohmann::json::object());
    }
    static const std::regex pattern("^[a-z0-9]+(-[a-z0-9]+)*$");
    auto result = std::regex_match(name, pattern);
    if (!result) {
        throw JsonValidationException(
            "Invalid organization name: " + name +
            ". It must be between 1 and 39 characters, only contain lowercase letters, "
            "numbers, and hyphens, "
            "cannot start or end with a hyphen, and cannot have consecutive hyphens.",
            nlohmann::json::object());
    }
}

ptr<OrganizationConfig> OrganizationConfig::createFromJson(
    const nlohmann::json &j, ptr<FileManager> fileManager) {
    try {
        CHECK_STATE(fileManager);
        std::string organizationName = JsonUtils::mustContainString(j, "name");
        CHECK_STATE_JSON(!organizationName.empty(), "Organization name cannot be empty", j);
        std::transform(
            organizationName.begin(), organizationName.end(), organizationName.begin(), ::tolower);
        validateOrgName(organizationName);
        std::string subdomain = JsonUtils::mustContainString(j, "subdomain");
        CHECK_STATE_JSON(!subdomain.empty(), "subdomain cannot be empty", j);
        static const std::regex label("^[a-z0-9]+(-[a-z0-9]+)*$");
        CHECK_STATE_JSON(std::regex_match(subdomain, label), "Invalid subdomain format", j);
        auto resources = ResourceConfig::createVectorFromJsonArray(j, fileManager);

        ptr<PassThroughConfig> passThroughConfig = nullptr;

        if (j.contains("passthrough")) {
            auto passThrough = j.at("passthrough");
            CHECK_STATE_JSON(passThrough.is_object(), "passthrough must be object", j);
            passThroughConfig = PassThroughConfig::createFromJson(passThrough, fileManager);
        }


        return ptr<OrganizationConfig>(
            new OrganizationConfig(resources, organizationName, subdomain, passThroughConfig));
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}

std::shared_ptr<std::vector<ptr<OrganizationConfig> > >
OrganizationConfig::createVectorFromJsonArray(
    const nlohmann::json &j, ptr<FileManager> fileManager) {
    try {
        CHECK_STATE(fileManager);
        auto result = std::make_shared<std::vector<ptr<OrganizationConfig> > >();
        if (!j.contains("organizations"))
            return result;
        auto organizations = j.at("organizations");
        CHECK_STATE_JSON(organizations.is_array(), "organizations must be an array", j);
        for (const auto &item: organizations) {
            auto org = OrganizationConfig::createFromJson(item, fileManager);
            if (org)
                result->push_back(org);
        }
        return result;
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}

ptr<OrganizationConfig> OrganizationConfig::createDefaultFromResources(
    ptr<vector<ptr<ResourceConfig> > > resources, ptr<PassThroughConfig> passThroughConfig) {
    return ptr<OrganizationConfig>(new OrganizationConfig(resources, "", "",
                                                          passThroughConfig));
}
