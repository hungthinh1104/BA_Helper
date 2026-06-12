Rails.application.routes.draw do
  # Supported: modern string handler syntax
  get "/refunds/:id", to: "refunds#show"
  post "/refunds", to: "refunds#create"
  put "/bookings/:booking_id", to: "bookings#update"

  # Supported: legacy hash rocket syntax (emits RB_CONTROLLER_RESOLUTION_BOUNDARY)
  delete "/bookings/:booking_id" => "bookings#destroy"

  # Unsupported patterns below, should emit diagnostics, not fake paths
  
  # RB_RESOURCE_ROUTE_UNSUPPORTED
  resources :invoices

  # RB_NAMESPACE_ROUTE_UNSUPPORTED
  namespace :admin do
    get "/dashboard", to: "dashboard#index"
  end

  # RB_SCOPE_ROUTE_UNSUPPORTED
  scope module: 'admin' do
    get "/metrics", to: "metrics#show"
  end

  # RB_DYNAMIC_ROUTE_UNSUPPORTED
  get "/dynamic/#{version}/route", to: "dynamic#show"

  # RB_MOUNTED_ENGINE_UNSUPPORTED
  mount ActionCable.server => '/cable'
end
