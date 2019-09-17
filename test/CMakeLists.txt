cet_enable_asserts()

# Make sure tests have correct environment settings.
include(CetTest)
# If you explicitly include CetTest in a subdirectory, you will need to
# re-initialize the test environment.
cet_test_env("FHICL_FILE_PATH=.")

# ELF, 7/24/2019: Temporarily disabling Plugins directory (MetricManager_t) as there are reliability issues. See Issue #22869
add_subdirectory(Plugins)
