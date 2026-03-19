# frozen_string_literal: true

RSpec.describe X402::Rails do
  it "has a version number" do
    expect(X402::Rails::VERSION).not_to be nil
  end

  it "defines the Error class" do
    expect(X402::Rails::Error).to be < StandardError
  end

  it "loads all required submodules" do
    expect(defined?(X402::Configuration)).to eq("constant")
    expect(defined?(X402::RequirementGenerator)).to eq("constant")
    expect(defined?(X402::PaymentValidator)).to eq("constant")
    expect(defined?(X402::FacilitatorClient)).to eq("constant")
  end
end
