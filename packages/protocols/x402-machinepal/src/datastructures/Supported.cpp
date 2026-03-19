#include "Supported.h"

Supported Supported::getDefault() {
    Supported s;
    s.kinds = { { 1, "exact", "base-sepolia" }, { 1, "exact", "base" },
        { 1, "exact", "avalanche-fuji" }, { 1, "exact", "avalanche" }, { 1, "exact", "iotex" } };
    return s;
}