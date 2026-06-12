using Microsoft.AspNetCore.Mvc;

namespace RefundApi.Controllers;

// CS_ROUTE_TOKEN_UNSUPPORTED — [controller] token cannot be resolved lexically
[Route("api/[controller]")]
[ApiController]
public class RefundController : ControllerBase
{
    // Supported: [HttpGet] with path template {refundId}
    [HttpGet("refunds/{refundId}")]
    public IActionResult GetRefund(string refundId) => Ok();

    // Supported: [HttpPost] with static path
    [HttpPost("refunds")]
    public IActionResult CreateRefund() => Ok();

    // CS_DI_BOUNDARY — constructor injection, does not block route extraction
    private readonly IRefundService _svc;
    public RefundController([FromServices] IRefundService svc) { _svc = svc; }
}
