// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package eip3009

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// Eip3009MetaData contains all meta data concerning the Eip3009 contract.
var Eip3009MetaData = &bind.MetaData{
	ABI: "[{\"name\":\"transferWithAuthorization\",\"type\":\"function\",\"inputs\":[{\"name\":\"from\",\"type\":\"address\"},{\"name\":\"to\",\"type\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\"},{\"name\":\"validAfter\",\"type\":\"uint256\"},{\"name\":\"validBefore\",\"type\":\"uint256\"},{\"name\":\"nonce\",\"type\":\"bytes32\"},{\"name\":\"signature\",\"type\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"name\":\"balanceOf\",\"type\":\"function\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\"}],\"outputs\":[{\"name\":\"balance\",\"type\":\"uint256\"}],\"stateMutability\":\"view\"}]",
}

// Eip3009ABI is the input ABI used to generate the binding from.
// Deprecated: Use Eip3009MetaData.ABI instead.
var Eip3009ABI = Eip3009MetaData.ABI

// Eip3009 is an auto generated Go binding around an Ethereum contract.
type Eip3009 struct {
	Eip3009Caller     // Read-only binding to the contract
	Eip3009Transactor // Write-only binding to the contract
	Eip3009Filterer   // Log filterer for contract events
}

// Eip3009Caller is an auto generated read-only Go binding around an Ethereum contract.
type Eip3009Caller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// Eip3009Transactor is an auto generated write-only Go binding around an Ethereum contract.
type Eip3009Transactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// Eip3009Filterer is an auto generated log filtering Go binding around an Ethereum contract events.
type Eip3009Filterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// Eip3009Session is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type Eip3009Session struct {
	Contract     *Eip3009          // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// Eip3009CallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type Eip3009CallerSession struct {
	Contract *Eip3009Caller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts  // Call options to use throughout this session
}

// Eip3009TransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type Eip3009TransactorSession struct {
	Contract     *Eip3009Transactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts  // Transaction auth options to use throughout this session
}

// Eip3009Raw is an auto generated low-level Go binding around an Ethereum contract.
type Eip3009Raw struct {
	Contract *Eip3009 // Generic contract binding to access the raw methods on
}

// Eip3009CallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type Eip3009CallerRaw struct {
	Contract *Eip3009Caller // Generic read-only contract binding to access the raw methods on
}

// Eip3009TransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type Eip3009TransactorRaw struct {
	Contract *Eip3009Transactor // Generic write-only contract binding to access the raw methods on
}

// NewEip3009 creates a new instance of Eip3009, bound to a specific deployed contract.
func NewEip3009(address common.Address, backend bind.ContractBackend) (*Eip3009, error) {
	contract, err := bindEip3009(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Eip3009{Eip3009Caller: Eip3009Caller{contract: contract}, Eip3009Transactor: Eip3009Transactor{contract: contract}, Eip3009Filterer: Eip3009Filterer{contract: contract}}, nil
}

// NewEip3009Caller creates a new read-only instance of Eip3009, bound to a specific deployed contract.
func NewEip3009Caller(address common.Address, caller bind.ContractCaller) (*Eip3009Caller, error) {
	contract, err := bindEip3009(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &Eip3009Caller{contract: contract}, nil
}

// NewEip3009Transactor creates a new write-only instance of Eip3009, bound to a specific deployed contract.
func NewEip3009Transactor(address common.Address, transactor bind.ContractTransactor) (*Eip3009Transactor, error) {
	contract, err := bindEip3009(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &Eip3009Transactor{contract: contract}, nil
}

// NewEip3009Filterer creates a new log filterer instance of Eip3009, bound to a specific deployed contract.
func NewEip3009Filterer(address common.Address, filterer bind.ContractFilterer) (*Eip3009Filterer, error) {
	contract, err := bindEip3009(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &Eip3009Filterer{contract: contract}, nil
}

// bindEip3009 binds a generic wrapper to an already deployed contract.
func bindEip3009(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := Eip3009MetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Eip3009 *Eip3009Raw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Eip3009.Contract.Eip3009Caller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Eip3009 *Eip3009Raw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Eip3009.Contract.Eip3009Transactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Eip3009 *Eip3009Raw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Eip3009.Contract.Eip3009Transactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Eip3009 *Eip3009CallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Eip3009.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Eip3009 *Eip3009TransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Eip3009.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Eip3009 *Eip3009TransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Eip3009.Contract.contract.Transact(opts, method, params...)
}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address account) view returns(uint256 balance)
func (_Eip3009 *Eip3009Caller) BalanceOf(opts *bind.CallOpts, account common.Address) (*big.Int, error) {
	var out []interface{}
	err := _Eip3009.contract.Call(opts, &out, "balanceOf", account)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address account) view returns(uint256 balance)
func (_Eip3009 *Eip3009Session) BalanceOf(account common.Address) (*big.Int, error) {
	return _Eip3009.Contract.BalanceOf(&_Eip3009.CallOpts, account)
}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address account) view returns(uint256 balance)
func (_Eip3009 *Eip3009CallerSession) BalanceOf(account common.Address) (*big.Int, error) {
	return _Eip3009.Contract.BalanceOf(&_Eip3009.CallOpts, account)
}

// TransferWithAuthorization is a paid mutator transaction binding the contract method 0xcf092995.
//
// Solidity: function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) returns()
func (_Eip3009 *Eip3009Transactor) TransferWithAuthorization(opts *bind.TransactOpts, from common.Address, to common.Address, value *big.Int, validAfter *big.Int, validBefore *big.Int, nonce [32]byte, signature []byte) (*types.Transaction, error) {
	return _Eip3009.contract.Transact(opts, "transferWithAuthorization", from, to, value, validAfter, validBefore, nonce, signature)
}

// TransferWithAuthorization is a paid mutator transaction binding the contract method 0xcf092995.
//
// Solidity: function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) returns()
func (_Eip3009 *Eip3009Session) TransferWithAuthorization(from common.Address, to common.Address, value *big.Int, validAfter *big.Int, validBefore *big.Int, nonce [32]byte, signature []byte) (*types.Transaction, error) {
	return _Eip3009.Contract.TransferWithAuthorization(&_Eip3009.TransactOpts, from, to, value, validAfter, validBefore, nonce, signature)
}

// TransferWithAuthorization is a paid mutator transaction binding the contract method 0xcf092995.
//
// Solidity: function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) returns()
func (_Eip3009 *Eip3009TransactorSession) TransferWithAuthorization(from common.Address, to common.Address, value *big.Int, validAfter *big.Int, validBefore *big.Int, nonce [32]byte, signature []byte) (*types.Transaction, error) {
	return _Eip3009.Contract.TransferWithAuthorization(&_Eip3009.TransactOpts, from, to, value, validAfter, validBefore, nonce, signature)
}
