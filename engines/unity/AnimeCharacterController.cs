using UnityEngine;

namespace BlendFactory.SkySanctuary_FantasyRPG
{
    /// <summary>
    /// Auto-synced Unity Third-Person Anime Fantasy Character Controller.
    /// Configured with BlendFactory Studio physics (Gravity: 9.81 m/s^2).
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class AnimeFantasyCharacterController : MonoBehaviour
    {
        [Header("Locomotion")]
        public float walkSpeed = 4.6f;
        public float sprintSpeed = 8.2f;
        public float jumpHeight = 1.65f;
        public float gravity = 9.81f;
        public float coyoteTime = 0.14f;

        [Header("Animator Rig")]
        public Animator animator;
        private CharacterController _cc;
        private Vector3 _velocity;
        private float _coyoteTimer;

        private void Awake()
        {
            _cc = GetComponent<CharacterController>();
        }

        private void Update()
        {
            float h = Input.GetAxisRaw("Horizontal");
            float v = Input.GetAxisRaw("Vertical");
            bool sprint = Input.GetKey(KeyCode.LeftShift);
            Vector3 move = new Vector3(h, 0f, v).normalized;
            float speed = sprint ? sprintSpeed : walkSpeed;

            if (move.sqrMagnitude > 0.01f)
            {
                Quaternion targetRot = Quaternion.LookRotation(move, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.deltaTime * 12f);
            }

            if (_cc.isGrounded)
            {
                _coyoteTimer = coyoteTime;
                if (_velocity.y < 0f) _velocity.y = -2f;
            }
            else
            {
                _coyoteTimer -= Time.deltaTime;
            }

            if (Input.GetButtonDown("Jump") && _coyoteTimer > 0f)
            {
                _velocity.y = Mathf.Sqrt(2f * gravity * jumpHeight);
                _coyoteTimer = 0f;
            }

            _velocity.y -= gravity * Time.deltaTime;
            _cc.Move((move * speed + _velocity) * Time.deltaTime);

            if (animator != null)
            {
                animator.SetFloat("Speed", move.magnitude * speed);
                animator.SetBool("IsGrounded", _cc.isGrounded);
            }
        }

        public void TriggerEmote(string stateName)
        {
            if (animator != null && !string.IsNullOrEmpty(stateName))
            {
                animator.CrossFadeInFixedTime(stateName, 0.18f);
            }
        }
    }
}
