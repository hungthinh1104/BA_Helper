// Minimal API entry point

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Supported: MapGet with {bookingId} path template
app.MapGet("/bookings/{bookingId}", GetBooking);

// Supported: MapPost static path
app.MapPost("/bookings", CreateBooking);

// CS_MINIMAL_API_GROUP_UNSUPPORTED — group joining not supported
var apiGroup = app.MapGroup("/api");
apiGroup.MapGet("/status", GetStatus);

// CS_DYNAMIC_ROUTE_UNSUPPORTED — non-literal path variable
var dynamicPath = "/dynamic/route";
app.MapGet(dynamicPath, GetDynamic);

app.Run();

static IResult GetBooking(string bookingId) => Results.Ok();
static IResult CreateBooking() => Results.Ok();
static IResult GetStatus() => Results.Ok();
static IResult GetDynamic() => Results.Ok();
