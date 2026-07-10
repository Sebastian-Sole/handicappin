# Injects the HandicappinWatchUITests UI-test target into the GENERATED
# Xcode project (ios/ is prebuild-managed, so this must re-run after every
# `expo prebuild`). Test sources live in targets/watch-ui-tests/ (committed).
#
# Run via: scripts/watch/run-watch-e2e.sh (or standalone:
#   GEM_HOME=$(dirname $(dirname $(readlink -f $(which pod)))) \
#     /opt/homebrew/opt/ruby/bin/ruby scripts/watch/add-watch-ui-tests-target.rb)
require 'xcodeproj'

project_path = File.expand_path('../../ios/Handicappin.xcodeproj', __dir__)
tests_dir = File.expand_path('../../targets/watch-ui-tests', __dir__)
target_name = 'HandicappinWatchUITests'

project = Xcodeproj::Project.open(project_path)

if project.targets.any? { |t| t.name == target_name }
  puts "#{target_name} already present — nothing to do"
  exit 0
end

watch_target = project.targets.find { |t| t.name == 'HandicappinWatch' }
abort 'HandicappinWatch target not found — run expo prebuild first' unless watch_target

target = project.new_target(:ui_test_bundle, target_name, :watchos, '10.0')

group = project.main_group.find_subpath("expo:targets/#{target_name}", true)
group.set_source_tree('<group>')
sources = Dir[File.join(tests_dir, '*.swift')].sort.map do |file|
  group.new_reference(file)
end
target.add_file_references(sources)

target.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_NAME'] = '$(TARGET_NAME)'
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.handicappin.app.watchkitapp.uitests'
  bs['TEST_TARGET_NAME'] = 'HandicappinWatch'
  bs['GENERATE_INFOPLIST_FILE'] = 'YES'
  bs['SWIFT_VERSION'] = '5.0'
  bs['SDKROOT'] = 'watchos'
  bs['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
  bs['TARGETED_DEVICE_FAMILY'] = '4'
  bs['CODE_SIGN_STYLE'] = 'Automatic'
  bs['CURRENT_PROJECT_VERSION'] = '1'
  bs['MARKETING_VERSION'] = '1.0'
end

target.add_dependency(watch_target)

# Shared scheme so `xcodebuild test -scheme HandicappinWatchUITests` works.
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(watch_target)
scheme.add_test_target(target)
scheme.set_launch_target(watch_target)
scheme.save_as(project_path, target_name, true)

project.save
puts "Added #{target_name} to #{project_path}"
