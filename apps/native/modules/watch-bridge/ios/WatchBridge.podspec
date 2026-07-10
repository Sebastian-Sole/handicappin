require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = package['version']
  s.summary        = 'WatchConnectivity bridge for the Handicappin Apple Watch companion'
  s.description    = 'Publishes round-session snapshots to the watch and relays watch frames into JS.'
  s.author         = ''
  s.homepage       = 'https://handicappin.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.license        = { :type => 'MIT' }

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
