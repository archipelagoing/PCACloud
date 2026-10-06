Gem::Specification.new do |spec|
  spec.name = "jekyll-theme-pca-cloud"
  spec.version = "0.1.0"
  spec.authors = ["Archisa Bhattacharya"]
  spec.summary = "PCA Cloud's sky and glass interface as a reusable Jekyll theme."
  spec.homepage = "https://github.com/archipelagoing/PCACloud"
  spec.license = "Apache-2.0"
  spec.required_ruby_version = ">= 3.1"
  spec.files = Dir["assets/**/*", "_layouts/**/*", "_includes/**/*", "LICENSE", "README.md"].select { |path| File.file?(path) }
  spec.add_runtime_dependency "jekyll", "~> 4.4"
end
